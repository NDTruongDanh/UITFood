import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  getNodePostgresSslConfig,
  requireDatabaseUrl,
} from '../postgres-connection';
import { restaurants } from '../../module/restaurant-catalog/restaurant/restaurant.schema';
import {
  reviews,
  type NewReview,
} from '../../module/review/domain/review.schema';
import { eq } from 'drizzle-orm';

const databaseUrl = requireDatabaseUrl();
const db = drizzle({
  connection: {
    connectionString: databaseUrl,
    ssl: getNodePostgresSslConfig(databaseUrl),
  },
});

const comments = [
  'Amazing food, highly recommended!',
  'The delivery was fast and the food was hot.',
  'Good portion size but a bit too salty for my taste.',
  'Will definitely order again.',
  'Average experience, nothing special.',
  'The packaging was excellent.',
  'Tastes exactly like how my mom used to make it.',
  'Not worth the price.',
  'Absolutely delicious!',
  'Best meal I have had in a while.',
];

const tagsList = [
  'Fast Delivery',
  'Great Taste',
  'Good Portion',
  'Hot Food',
  'Well Packaged',
  'Value for Money',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateReviewsForRestaurant(
  restaurantId: string,
  count: number,
): {
  generatedReviews: NewReview[];
  ratingSum: number;
  reviewCount: number;
} {
  const generatedReviews: NewReview[] = [];
  let ratingSum = 0;

  for (let i = 0; i < count; i++) {
    // Bias towards 4 and 5 stars
    const r = Math.random();
    let stars = 5;
    if (r < 0.1) stars = 1;
    else if (r < 0.2) stars = 2;
    else if (r < 0.4) stars = 3;
    else if (r < 0.7) stars = 4;

    ratingSum += stars;

    const orderId = crypto.randomUUID();
    const customerId = crypto.randomUUID();

    const selectedTags: string[] = [];
    const numTags = randomInt(0, 3);
    for (let j = 0; j < numTags; j++) {
      const tag = randomItem(tagsList);
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    }

    generatedReviews.push({
      id: crypto.randomUUID(),
      orderId,
      customerId,
      restaurantId,
      stars,
      comment: Math.random() > 0.3 ? randomItem(comments) : null,
      tags: selectedTags.length > 0 ? selectedTags : null,
      createdAt: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000),
    });
  }

  return { generatedReviews, ratingSum, reviewCount: count };
}

async function seedReviews() {
  try {
    console.log('⭐ Seeding reviews for all restaurants...');

    const allRestaurants = await db
      .select({ id: restaurants.id })
      .from(restaurants);

    if (allRestaurants.length === 0) {
      console.log('No restaurants found to seed reviews.');
      return;
    }

    let totalReviews = 0;

    for (const restaurant of allRestaurants) {
      const numReviews = randomInt(5, 20);
      const { generatedReviews, ratingSum, reviewCount } =
        generateReviewsForRestaurant(restaurant.id, numReviews);

      // Insert reviews
      await db.insert(reviews).values(generatedReviews);

      // Update restaurant stats
      const averageRating = ratingSum / reviewCount;
      await db
        .update(restaurants)
        .set({
          ratingSum,
          reviewCount,
          averageRating,
        })
        .where(eq(restaurants.id, restaurant.id));

      totalReviews += reviewCount;
    }

    console.log(
      `\n✅ Successfully seeded ${totalReviews} reviews across ${allRestaurants.length} restaurants!`,
    );
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

void seedReviews().then(() => process.exit(0));
