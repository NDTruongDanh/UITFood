import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { reviews, type NewReview, type Review } from '../domain/review.schema';
import type { UnitOfWorkContext } from '@/shared/ports/unit-of-work-context';

/**
 * ReviewRepository
 *
 * Data-access layer for the `reviews` table. All queries are parameterized
 * Drizzle expressions — never raw SQL string interpolation (QA-S-05).
 *
 * Phase: RV-2
 */
@Injectable()
export class ReviewRepository {
  constructor(@Inject(DB_CONNECTION) private readonly db: NodePgDatabase) {}

  async create(
    values: NewReview,
    context?: UnitOfWorkContext,
  ): Promise<Review> {
    const database =
      (context?.transaction as NodePgDatabase | undefined) ?? this.db;
    const [created] = await database.insert(reviews).values(values).returning();
    return created;
  }
  /**
   * Find the review for a given order — used by:
   *  - SubmitReviewHandler optimistic pre-check (BR-22.9)
   *  - GET /reviews/my/:orderId
   *
   * Returns the single review row (UNIQUE on order_id guarantees ≤ 1).
   */
  async findByOrderId(orderId: string): Promise<Review | null> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Find a review only if it belongs to the given customer.
   * Used by GET /reviews/my/:orderId to enforce ownership without a
   * separate authorization round-trip.
   */
  async findByOrderIdAndCustomerId(
    orderId: string,
    customerId: string,
  ): Promise<Review | null> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.orderId, orderId), eq(reviews.customerId, customerId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Paginated public listing for a restaurant.
   * Excludes reviews with moderationStatus !== 'visible' (BR-22.13).
   *
   * @param page  — 1-based page index
   * @param limit — page size (caller validates max 50)
   */
  async findByRestaurantId(
    restaurantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Review[]; total: number }> {
    const where = and(
      eq(reviews.restaurantId, restaurantId),
      eq(reviews.moderationStatus, 'visible'),
    );

    const offset = (page - 1) * limit;

    const [data, totalRows] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(reviews).where(where),
    ]);

    return { data, total: Number(totalRows[0]?.value ?? 0) };
  }

  /**
   * Paginated admin listing for a restaurant.
   * Includes all reviews regardless of moderationStatus.
   * Rating statistics use the same all-review population as the listing.
   *
   * @param page  — 1-based page index
   * @param limit — page size (caller validates max 50)
   */
  async findAdminByRestaurantId(
    restaurantId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Review[];
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  }> {
    const where = eq(reviews.restaurantId, restaurantId);
    const offset = (page - 1) * limit;

    const [data, aggregateRows, distributionRows] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({
          total: count(),
          averageRating: sql<number>`COALESCE(AVG(${reviews.stars}), 0)::float8`,
        })
        .from(reviews)
        .where(where),
      this.db
        .select({
          stars: reviews.stars,
          count: count(),
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.stars),
    ]);

    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of distributionRows) {
      if (row.stars >= 1 && row.stars <= 5) {
        ratingDistribution[row.stars] = Number(row.count);
      }
    }

    return {
      data,
      total: Number(aggregateRows[0]?.total ?? 0),
      averageRating: Number(aggregateRows[0]?.averageRating ?? 0),
      ratingDistribution,
    };
  }
}
