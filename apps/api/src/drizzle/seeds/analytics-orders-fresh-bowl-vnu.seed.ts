import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  getNodePostgresSslConfig,
  requireDatabaseUrl,
} from '../postgres-connection';
import {
  orders,
  orderItems,
  orderStatusLogs,
} from '../../module/ordering/order/order.schema';
import type { CancellationReason } from '../../module/ordering/order/order.schema';

const databaseUrl = requireDatabaseUrl();
const db = drizzle({
  connection: {
    connectionString: databaseUrl,
    ssl: getNodePostgresSslConfig(databaseUrl),
  },
});

const RESTAURANT_ID = '56000003-0000-4000-8000-000000000001';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const RESTAURANT_NAME = 'Fresh Bowl VNU';

const menuItems = [
  {
    id: '56000006-0000-4000-8000-000000000001',
    name: 'Lemongrass Chicken Rice Bowl',
    price: 68000,
  },
  {
    id: '56000006-0000-4000-8000-000000000002',
    name: 'Tofu Brown Rice Bowl',
    price: 62000,
  },
  {
    id: '56000006-0000-4000-8000-000000000003',
    name: 'Shrimp Vermicelli Salad',
    price: 72000,
  },
  {
    id: '56000006-0000-4000-8000-000000000004',
    name: 'Beef Pho Protein Bowl',
    price: 79000,
  },
];

const cancellationReasons: CancellationReason[] = [
  'kitchen_cancel',
  'driver_no_show',
  'out_of_stock',
  'customer_request',
  'payment_failed',
  'timeout',
  'other',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedAnalyticsOrders() {
  try {
    console.log(`🍽️  Creating analytics orders for ${RESTAURANT_NAME}...\n`);

    const totalOrders = 80;
    let count = 0;

    for (let i = 0; i < totalOrders; i++) {
      const orderId = crypto.randomUUID();
      const cartId = crypto.randomUUID();
      const item = randomItem(menuItems);

      // Random date between now and 7 days ago
      const daysAgo = Math.random() * 7;
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const isFailed = Math.random() < 0.2; // 20% fail rate
      const finalStatus = isFailed
        ? Math.random() > 0.5
          ? 'cancelled'
          : 'refunded'
        : 'delivered';
      const reasonCode = isFailed ? randomItem(cancellationReasons) : null;

      const subtotal = item.price;
      const shippingFee = randomInt(15, 30) * 1000;

      await db.insert(orders).values({
        id: orderId,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        restaurantName: RESTAURANT_NAME,
        cartId,
        status: finalStatus,
        totalAmount: subtotal + shippingFee,
        shippingFee: shippingFee,
        discountAmount: 0,
        paymentMethod: 'cod',
        deliveryAddress: {
          street: 'Internal Road, VNU-HCM University Village',
          district: 'Linh Trung',
          city: 'Thu Duc',
          latitude: 10.8928,
          longitude: 106.7915,
        },
        estimatedDeliveryMinutes: 35,
        createdAt,
      });

      await db.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: item.id,
        itemName: item.name,
        unitPrice: item.price,
        modifiersPrice: 0,
        quantity: 1,
        subtotal: item.price,
        modifiers: [],
      });

      // Initial creation log
      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: null,
        toStatus: 'pending',
        triggeredByRole: 'system',
        createdAt,
      });

      // Acceptance transition (time to accept)
      const acceptSeconds = randomInt(10, 240); // 10s to 4m
      const acceptedAt = new Date(createdAt.getTime() + acceptSeconds * 1000);

      await db.insert(orderStatusLogs).values({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: 'pending',
        toStatus: 'confirmed',
        triggeredByRole: 'restaurant',
        createdAt: acceptedAt,
      });

      if (isFailed) {
        // Failed transition
        const failedAt = new Date(
          acceptedAt.getTime() + randomInt(60, 600) * 1000,
        );
        await db.insert(orderStatusLogs).values({
          id: crypto.randomUUID(),
          orderId,
          fromStatus: 'confirmed',
          toStatus: finalStatus,
          triggeredByRole: 'system',
          cancellationReason: reasonCode,
          note: 'Seed generated failure',
          createdAt: failedAt,
        });
      } else {
        // Ready for pickup transition
        const prepSeconds = randomInt(300, 1200); // 5m to 20m
        const readyAt = new Date(acceptedAt.getTime() + prepSeconds * 1000);

        await db.insert(orderStatusLogs).values({
          id: crypto.randomUUID(),
          orderId,
          fromStatus: 'confirmed',
          toStatus: 'ready_for_pickup',
          triggeredByRole: 'restaurant',
          createdAt: readyAt,
        });

        // Delivered transition
        const deliveredAt = new Date(
          readyAt.getTime() + randomInt(600, 1800) * 1000,
        );
        await db.insert(orderStatusLogs).values({
          id: crypto.randomUUID(),
          orderId,
          fromStatus: 'ready_for_pickup',
          toStatus: 'delivered',
          triggeredByRole: 'shipper',
          createdAt: deliveredAt,
        });
      }

      count++;
    }

    console.log(`\n✅ ${count} analytics orders created successfully!`);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

void seedAnalyticsOrders().then(() => process.exit(0));
