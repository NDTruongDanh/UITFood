import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  sql,
  and,
  gte,
  lt,
  ne,
  eq,
  notInArray,
  desc,
  asc,
  count,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
// Reporting is the sole read-only exception allowed to compose context-owned tables.
import {
  orderItems,
  orders,
  orderStatusLogs,
} from '@/module/ordering/order/order.schema';
import { restaurants } from '@/module/restaurant-catalog/restaurant/restaurant.schema';

export interface PlatformScalars {
  gmv: number;
  orderCount: number;
  deliveredCount: number;
  failedCount: number;
}

export interface RestaurantCounts {
  online: number;
  offline: number;
  pending: number;
}

export interface HourlyPoint {
  hour: Date;
  orders: number;
  revenue: number;
}

export interface TopEarnerRow {
  restaurantId: string;
  restaurantName: string;
  gmv: number;
  orderCount: number;
}

export interface BottleneckRow {
  restaurantId: string;
  restaurantName: string;
  cancelRate: number;
  avgPrepMinutes: number | null;
  orderCount: number;
  primaryIssue: 'high-cancel' | 'slow-prep';
}

export interface DistrictRow {
  district: string;
  orderCount: number;
}

export interface RestaurantAnalyticsData {
  totalRevenue: number;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  avgPrepMinutes: number | null;
  revenueByDay: { date: string; revenue: number }[];
  ordersByDay: { date: string; count: number }[];
  topItems: {
    menuItemId: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

const COMMISSION_RATE = 0.15;

@Injectable()
export class AdminAnalyticsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  // ---------------------------------------------------------------------------
  // Platform-wide scalars (GMV, order counts)
  // ---------------------------------------------------------------------------

  async getPlatformScalars(start: Date, end: Date): Promise<PlatformScalars> {
    const windowFilter = and(
      gte(orders.createdAt, start),
      lt(orders.createdAt, end),
    );

    const rows = await this.db
      .select({
        gmv: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)::bigint`,
        orderCount: count(),
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'delivered')::int`,
        failedCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('cancelled', 'refunded'))::int`,
      })
      .from(orders)
      .where(windowFilter);

    const r = rows[0];
    return {
      gmv: Number(r?.gmv ?? 0),
      orderCount: Number(r?.orderCount ?? 0),
      deliveredCount: r?.deliveredCount ?? 0,
      failedCount: r?.failedCount ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Restaurant status counts (from the catalog, not window-bounded)
  // ---------------------------------------------------------------------------

  async getRestaurantCounts(): Promise<RestaurantCounts> {
    const rows = await this.db
      .select({
        online: sql<number>`COUNT(*) FILTER (WHERE ${restaurants.isApproved} = true  AND ${restaurants.isOpen} = true)::int`,
        offline: sql<number>`COUNT(*) FILTER (WHERE ${restaurants.isApproved} = true  AND ${restaurants.isOpen} = false)::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${restaurants.isApproved} = false)::int`,
      })
      .from(restaurants);

    const r = rows[0];
    return {
      online: r?.online ?? 0,
      offline: r?.offline ?? 0,
      pending: r?.pending ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Hourly load: orders + revenue per UTC hour in the window
  // ---------------------------------------------------------------------------

  async getHourlyLoad(start: Date, end: Date): Promise<HourlyPoint[]> {
    const rows = await this.db
      .select({
        hour: sql<string>`date_trunc('hour', ${orders.createdAt})`.as('hour'),
        orders: count().as('orders'),
        revenue:
          sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)::bigint`.as(
            'revenue',
          ),
      })
      .from(orders)
      .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
      .groupBy(sql`hour`)
      .orderBy(asc(sql`hour`));

    return rows.map((r) => ({
      hour: new Date(r.hour),
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    }));
  }

  // ---------------------------------------------------------------------------
  // Top 5 earners by GMV, excluding cancelled/refunded orders
  // ---------------------------------------------------------------------------

  async getTopEarners(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<TopEarnerRow[]> {
    const rows = await this.db
      .select({
        restaurantId: orders.restaurantId,
        restaurantName: orders.restaurantName,
        gmv: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)::bigint`,
        orderCount: count(),
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, start),
          lt(orders.createdAt, end),
          notInArray(orders.status, ['cancelled', 'refunded']),
        ),
      )
      .groupBy(orders.restaurantId, orders.restaurantName)
      .orderBy(desc(sql`COALESCE(SUM(${orders.totalAmount}), 0)`))
      .limit(limit);

    return rows.map((r) => ({
      restaurantId: r.restaurantId,
      restaurantName: r.restaurantName,
      gmv: Number(r.gmv),
      orderCount: Number(r.orderCount),
    }));
  }

  // ---------------------------------------------------------------------------
  // Bottleneck watchlist: restaurants with high cancel rate or slow prep
  // Minimum 5 orders in window to be included.
  // ---------------------------------------------------------------------------

  async getBottlenecks(
    start: Date,
    end: Date,
    limit = 5,
  ): Promise<BottleneckRow[]> {
    const lConf = alias(orderStatusLogs, 'l_conf');
    const lReady = alias(orderStatusLogs, 'l_ready');

    // CTE 1: cancel rate per restaurant
    const orderStats = this.db.$with('order_stats').as(
      this.db
        .select({
          restaurantId: orders.restaurantId,
          restaurantName: orders.restaurantName,
          total: count().as('total'),
          failed:
            sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('cancelled', 'refunded'))::int`.as(
              'failed',
            ),
        })
        .from(orders)
        .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
        .groupBy(orders.restaurantId, orders.restaurantName),
    );

    // CTE 2: avg prep time (confirmed → ready_for_pickup) per restaurant
    const prepLatency = this.db.$with('prep_latency').as(
      this.db
        .select({
          restaurantId: orders.restaurantId,
          avgPrepSeconds:
            sql<number>`AVG(EXTRACT(EPOCH FROM (${lReady.createdAt} - ${lConf.createdAt})))::float8`.as(
              'avg_prep_seconds',
            ),
        })
        .from(orders)
        .innerJoin(
          lConf,
          and(eq(lConf.orderId, orders.id), eq(lConf.toStatus, 'confirmed')),
        )
        .innerJoin(
          lReady,
          and(
            eq(lReady.orderId, orders.id),
            eq(lReady.toStatus, 'ready_for_pickup'),
          ),
        )
        .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
        .groupBy(orders.restaurantId),
    );

    const rows = await this.db
      .with(orderStats, prepLatency)
      .select({
        restaurantId: orderStats.restaurantId,
        restaurantName: orderStats.restaurantName,
        total: orderStats.total,
        failed: orderStats.failed,
        avgPrepSeconds: prepLatency.avgPrepSeconds,
      })
      .from(orderStats)
      .leftJoin(
        prepLatency,
        eq(prepLatency.restaurantId, orderStats.restaurantId),
      )
      .where(
        and(
          // Require minimum volume before calling something a bottleneck
          sql`${orderStats.total} >= 5`,
          // Flag if cancel rate > 5% or avg prep > 30 minutes
          sql`(
            ${orderStats.failed}::float / NULLIF(${orderStats.total}, 0) > 0.05
            OR ${prepLatency.avgPrepSeconds} > 1800
          )`,
        ),
      )
      .orderBy(
        desc(sql`${orderStats.failed}::float / NULLIF(${orderStats.total}, 0)`),
      )
      .limit(limit);

    return rows.map((r) => {
      const cancelRate =
        Number(r.total) > 0 ? Number(r.failed) / Number(r.total) : 0;
      const avgPrepMinutes =
        r.avgPrepSeconds != null
          ? Math.round(Number(r.avgPrepSeconds) / 60)
          : null;
      const primaryIssue: BottleneckRow['primaryIssue'] =
        cancelRate > 0.05 ? 'high-cancel' : 'slow-prep';
      return {
        restaurantId: r.restaurantId,
        restaurantName: r.restaurantName,
        cancelRate,
        avgPrepMinutes,
        orderCount: Number(r.total),
        primaryIssue,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Orders grouped by district (from deliveryAddress JSONB)
  // ---------------------------------------------------------------------------

  async getOrdersByDistrict(
    start: Date,
    end: Date,
    limit = 15,
  ): Promise<DistrictRow[]> {
    const rows = await this.db
      .select({
        district: sql<string>`${orders.deliveryAddress}->>'district'`.as(
          'district',
        ),
        orderCount: count().as('order_count'),
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, start),
          lt(orders.createdAt, end),
          sql`${orders.deliveryAddress}->>'district' IS NOT NULL`,
          ne(sql<string>`${orders.deliveryAddress}->>'district'`, ''),
        ),
      )
      .groupBy(sql`district`)
      .orderBy(desc(sql`order_count`))
      .limit(limit);

    return rows.map((r) => ({
      district: r.district,
      orderCount: Number(r.orderCount),
    }));
  }

  get commissionRate(): number {
    return COMMISSION_RATE;
  }

  async getRestaurantAnalyticsData(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<RestaurantAnalyticsData> {
    const windowFilter = and(
      eq(orders.restaurantId, restaurantId),
      gte(orders.createdAt, start),
      lt(orders.createdAt, end),
    );

    const scalarsQuery = this.db
      .select({
        // Restaurant sales exclude delivery fees and include order discounts.
        totalRevenue: sql<number>`COALESCE(SUM(${orders.totalAmount} - ${orders.shippingFee}) FILTER (WHERE ${orders.status} = 'delivered'), 0)::bigint`,
        orderCount: count(),
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'delivered')::int`,
        cancelledCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('cancelled', 'refunded'))::int`,
      })
      .from(orders)
      .where(windowFilter);

    const lConf = alias(orderStatusLogs, 'l_conf');
    const lReady = alias(orderStatusLogs, 'l_ready');
    const prepQuery = this.db
      .select({
        avgPrepSeconds: sql<number>`AVG(EXTRACT(EPOCH FROM (${lReady.createdAt} - ${lConf.createdAt})))::float8`,
      })
      .from(orders)
      .innerJoin(
        lConf,
        and(eq(lConf.orderId, orders.id), eq(lConf.toStatus, 'confirmed')),
      )
      .innerJoin(
        lReady,
        and(
          eq(lReady.orderId, orders.id),
          eq(lReady.toStatus, 'ready_for_pickup'),
        ),
      )
      .where(windowFilter);

    const dailyQuery = this.db
      .select({
        day: sql<string>`date_trunc('day', ${orders.createdAt})`.as('day'),
        orders: count().as('orders'),
        revenue:
          sql<number>`COALESCE(SUM(${orders.totalAmount} - ${orders.shippingFee}) FILTER (WHERE ${orders.status} = 'delivered'), 0)::bigint`.as(
            'revenue',
          ),
      })
      .from(orders)
      .where(windowFilter)
      .groupBy(sql`day`)
      .orderBy(asc(sql`day`));

    const topItemsQuery = this.db
      .select({
        menuItemId: orderItems.menuItemId,
        name: orderItems.itemName,
        quantity: sql<number>`SUM(${orderItems.quantity})::bigint`,
        revenue: sql<number>`SUM(${orderItems.subtotal})::bigint`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(windowFilter, eq(orders.status, 'delivered')))
      .groupBy(orderItems.menuItemId, orderItems.itemName)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(10);

    const [scalarsRows, prepRows, dailyRows, itemsRows] = await Promise.all([
      scalarsQuery,
      prepQuery,
      dailyQuery,
      topItemsQuery,
    ]);

    const scalars = scalarsRows[0];
    const avgPrepMinutes =
      prepRows[0]?.avgPrepSeconds != null
        ? Math.round(Number(prepRows[0].avgPrepSeconds) / 60)
        : null;

    const revenueByDay = dailyRows.map((row) => ({
      date: new Date(row.day).toISOString(),
      revenue: Number(row.revenue),
    }));
    const ordersByDay = dailyRows.map((row) => ({
      date: new Date(row.day).toISOString(),
      count: Number(row.orders),
    }));

    return {
      totalRevenue: Number(scalars?.totalRevenue ?? 0),
      orderCount: Number(scalars?.orderCount ?? 0),
      deliveredCount: Number(scalars?.deliveredCount ?? 0),
      cancelledCount: Number(scalars?.cancelledCount ?? 0),
      avgPrepMinutes,
      revenueByDay,
      ordersByDay,
      topItems: itemsRows.map((row) => ({
        menuItemId: row.menuItemId,
        name: row.name,
        quantity: Number(row.quantity),
        revenue: Number(row.revenue),
      })),
    };
  }
}
