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
import { restaurants } from '../../module/restaurant-catalog/restaurant/restaurant.schema';
import { menuItems } from '../../module/restaurant-catalog/menu/menu.schema';
import type {
  CancellationReason,
  NewOrderItem,
} from '../../module/ordering/order/order.schema';

const databaseUrl = requireDatabaseUrl();
const db = drizzle({
  connection: {
    connectionString: databaseUrl,
    ssl: getNodePostgresSslConfig(databaseUrl),
  },
});

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

async function seedAnalyticsOrdersAdmin() {
  try {
    console.log('🍽️  Fetching restaurants and menu items...');

    const allRestaurants = await db
      .select({ id: restaurants.id, name: restaurants.name })
      .from(restaurants);

    if (allRestaurants.length === 0) {
      console.log('❌ No restaurants found. Please seed restaurants first.');
      process.exit(1);
    }

    const allMenuItems = await db
      .select({
        id: menuItems.id,
        restaurantId: menuItems.restaurantId,
        name: menuItems.name,
        price: menuItems.price,
      })
      .from(menuItems);

    if (allMenuItems.length === 0) {
      console.log('❌ No menu items found. Please seed restaurants first.');
      process.exit(1);
    }

    // Group menu items by restaurant
    const menuItemsByRestaurant = new Map<string, typeof allMenuItems>();
    for (const item of allMenuItems) {
      if (!menuItemsByRestaurant.has(item.restaurantId)) {
        menuItemsByRestaurant.set(item.restaurantId, []);
      }
      menuItemsByRestaurant.get(item.restaurantId)!.push(item);
    }

    // Filter restaurants that have menu items
    const validRestaurants = allRestaurants.filter(
      (r) =>
        menuItemsByRestaurant.has(r.id) &&
        menuItemsByRestaurant.get(r.id)!.length > 0,
    );

    if (validRestaurants.length === 0) {
      console.log('❌ No valid restaurants with menu items found.');
      process.exit(1);
    }

    console.log(`🍽️  Found ${validRestaurants.length} valid restaurants.`);
    console.log('🍽️  Creating analytics orders for admin dashboard...\n');

    const totalOrders = 300; // Generate 300 orders
    let count = 0;

    for (let i = 0; i < totalOrders; i++) {
      const orderId = crypto.randomUUID();
      const cartId = crypto.randomUUID();
      const customerId = crypto.randomUUID();

      const restaurant = randomItem(validRestaurants);
      const restaurantMenuItems = menuItemsByRestaurant.get(restaurant.id)!;

      // Random date between now and 30 days ago to show monthly trends
      const daysAgo = Math.random() * 30;
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const isFailed = Math.random() < 0.2; // 20% fail rate
      const finalStatus = isFailed
        ? Math.random() > 0.5
          ? 'cancelled'
          : 'refunded'
        : 'delivered';
      const reasonCode = isFailed ? randomItem(cancellationReasons) : null;

      // Add 1-3 items
      const numItems = randomInt(1, 3);
      let subtotal = 0;
      const itemsToInsert: NewOrderItem[] = [];

      for (let j = 0; j < numItems; j++) {
        const currentItem = randomItem(restaurantMenuItems);
        const quantity = randomInt(1, 2);
        const itemSubtotal = currentItem.price * quantity;
        subtotal += itemSubtotal;

        itemsToInsert.push({
          id: crypto.randomUUID(),
          orderId,
          menuItemId: currentItem.id,
          itemName: currentItem.name,
          unitPrice: currentItem.price,
          modifiersPrice: 0,
          quantity: quantity,
          subtotal: itemSubtotal,
          modifiers: [],
        });
      }

      const shippingFee = randomInt(15, 30) * 1000;

      await db.insert(orders).values({
        id: orderId,
        customerId: customerId,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        cartId,
        status: finalStatus,
        totalAmount: subtotal + shippingFee,
        shippingFee: shippingFee,
        discountAmount: 0,
        paymentMethod: 'cod',
        deliveryAddress: {
          street: 'Admin Test Address',
          district: 'District 1',
          city: 'Ho Chi Minh',
          latitude: 10.7769,
          longitude: 106.7009,
        },
        estimatedDeliveryMinutes: 35,
        createdAt,
      });

      for (const item of itemsToInsert) {
        await db.insert(orderItems).values(item);
      }

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
      if (count % 50 === 0) {
        console.log(`... created ${count} orders`);
      }
    }

    console.log(
      `\n✅ ${count} analytics orders created successfully for Admin Dashboard!`,
    );
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

void seedAnalyticsOrdersAdmin().then(() => process.exit(0));
