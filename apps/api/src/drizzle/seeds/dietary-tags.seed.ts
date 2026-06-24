import 'dotenv/config';
import { db } from '../db';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';
import { dietaryTagSeeds } from './dietary-tags.data';

async function seedDietaryTags() {
  console.log('Seeding dietary tags...');
  let count = 0;

  for (const tag of dietaryTagSeeds) {
    try {
      const existing = await db
        .select()
        .from(schema.dietaryTags)
        .where(eq(schema.dietaryTags.slug, tag.slug))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.dietaryTags)
          .set({
            name: tag.name,
            description: tag.description,
            category: tag.category,
            updatedAt: new Date(),
          })
          .where(eq(schema.dietaryTags.id, existing[0].id));
        console.log(`✅ Updated existing tag: ${tag.name}`);
      } else {
        await db.insert(schema.dietaryTags).values(tag);
        console.log(`✅ Inserted new tag: ${tag.name}`);
      }
      count++;
    } catch (error) {
      console.error(`❌ Error processing tag ${tag.name}:`, error);
    }
  }

  console.log(`\n✨ Successfully processed ${count} dietary tags!`);
}

seedDietaryTags()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Dietary tags seeding failed:', err);
    process.exit(1);
  });
