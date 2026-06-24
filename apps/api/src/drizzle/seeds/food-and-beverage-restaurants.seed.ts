import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../schema';
import type {
  ExtractedRecipe,
  IngredientCategory,
  NutritionAmount,
  NutritionUnit,
  PreparationState,
} from '../../module/restaurant-catalog/nutrition/types/nutrition.types';
import { dietaryTagSlugs, type DietaryTagSlug } from './dietary-tags.data';

type SeedImage = {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
};

type NutritionFoodSeed = {
  key: string;
  nameVi: string;
  nameEn: string;
  aliases: string[];
  category: string;
  state: 'raw' | 'cooked' | 'fried' | 'boiled' | 'grilled' | 'unknown';
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fiber100g: number;
  sugar100g: number;
  sodium100g: number;
};

type RecipeIngredientSeed = {
  foodKey: string;
  name: string;
  canonicalNameEn: string;
  quantity: number;
  unit: NutritionUnit;
  quantityGram: number;
  preparation: PreparationState;
  category: IngredientCategory;
};

type ModifierOptionSeed = {
  name: string;
  price: number;
  isDefault?: boolean;
};

type ModifierGroupSeed = {
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOptionSeed[];
};

type MenuItemSeed = {
  id: string;
  analysisSessionId: string;
  name: string;
  description: string;
  price: number;
  itemKind: 'food' | 'beverage' | 'mixed';
  tags: DietaryTagSlug[];
  imageUrl: string;
  servings: number;
  ingredients: RecipeIngredientSeed[];
  modifiers?: ModifierGroupSeed[];
};

type RestaurantSeed = {
  id: string;
  ownerId: string;
  categoryId: string;
  zoneId: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  cuisineType: string;
  logoUrl: string;
  coverImageUrl: string;
  latitude: number;
  longitude: number;
  categoryName: string;
  items: MenuItemSeed[];
};

const TARGET_LATITUDE = 10.8928;
const TARGET_LONGITUDE = 106.7915;

const image = (
  publicId: string,
  remoteImageId: string,
  width = 1200,
  height = 800,
): SeedImage => ({
  publicId,
  secureUrl: `https://res.cloudinary.com/demo/image/fetch/c_fill,w_${width},h_${height},q_auto,f_auto/https://images.unsplash.com/${remoteImageId}`,
  width,
  height,
});

const seedImages = {
  cafeLogo: image(
    'food-and-beverage-restaurants/restaurants/cafe-logo',
    'photo-1554118811-1e0d58224f24',
    512,
    512,
  ),
  cafeCover: image(
    'food-and-beverage-restaurants/restaurants/cafe-cover',
    'photo-1497935586351-b67a49e012bf',
  ),
  croissant: image(
    'food-and-beverage-restaurants/menu/croissant',
    'photo-1555507036-ab1f4038808a',
  ),
  clubSandwich: image(
    'food-and-beverage-restaurants/menu/club-sandwich',
    'photo-1528735602780-2552fd46c7af',
  ),
  icedLatte: image(
    'food-and-beverage-restaurants/menu/iced-latte',
    'photo-1517701550927-30cf4ba1dba5',
  ),
  matchaLatte: image(
    'food-and-beverage-restaurants/menu/matcha-latte',
    'photo-1515823662972-da6a2e4d3002',
  ),
} satisfies Record<string, SeedImage>;

const foodAndBeverageImages = Object.values(seedImages);

function seedId(group: number, index: number): string {
  return `580000${group.toString().padStart(2, '0')}-0000-4000-8000-${index
    .toString()
    .padStart(12, '0')}`;
}

const foodAndBeverageOwners = [
  {
    id: seedId(1, 1),
    accountId: seedId(2, 1),
    name: 'Study Cafe Owner',
    email: 'study-cafe-owner@soli.dev',
    password: 'password1234',
    restaurantName: 'Study Cafe & Bistro',
  },
];

const nutritionFoodSeeds: NutritionFoodSeed[] = [
  nutritionFood('espresso', 'ca phe espresso', 'espresso', {
    aliases: ['espresso'],
    category: 'beverage',
    state: 'cooked',
    calories100g: 9,
    protein100g: 0.1,
    carbs100g: 1.7,
    fat100g: 0.2,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 14,
  }),
  nutritionFood('milkWhole', 'sua tuoi nguyen kem', 'whole milk', {
    aliases: ['milk', 'sua tuoi'],
    category: 'dairy',
    state: 'unknown',
    calories100g: 61,
    protein100g: 3.2,
    carbs100g: 4.8,
    fat100g: 3.3,
    fiber100g: 0,
    sugar100g: 4.8,
    sodium100g: 43,
  }),
  nutritionFood('matchaPowder', 'bot matcha', 'matcha powder', {
    aliases: ['matcha'],
    category: 'beverage',
    state: 'unknown',
    calories100g: 276,
    protein100g: 28,
    carbs100g: 38,
    fat100g: 0,
    fiber100g: 28,
    sugar100g: 0,
    sodium100g: 0,
  }),
  nutritionFood('croissant', 'banh sung bo', 'croissant', {
    aliases: ['croissant'],
    category: 'grain',
    state: 'cooked',
    calories100g: 406,
    protein100g: 8.2,
    carbs100g: 45.8,
    fat100g: 21,
    fiber100g: 2.6,
    sugar100g: 11.3,
    sodium100g: 467,
  }),
  nutritionFood('breadWhite', 'banh mi trang', 'white bread', {
    aliases: ['sandwich bread', 'banh mi'],
    category: 'grain',
    state: 'cooked',
    calories100g: 266,
    protein100g: 8.8,
    carbs100g: 50.6,
    fat100g: 3.3,
    fiber100g: 2.7,
    sugar100g: 5.7,
    sodium100g: 491,
  }),
  nutritionFood('ham', 'thit nguoi', 'ham', {
    aliases: ['sliced ham'],
    category: 'protein',
    state: 'cooked',
    calories100g: 145,
    protein100g: 17,
    carbs100g: 1.5,
    fat100g: 8,
    fiber100g: 0,
    sugar100g: 0,
    sodium100g: 1200,
  }),
  nutritionFood('cheeseCheddar', 'pho mai cheddar', 'cheddar cheese', {
    aliases: ['cheese', 'pho mai'],
    category: 'dairy',
    state: 'unknown',
    calories100g: 402,
    protein100g: 25,
    carbs100g: 1.3,
    fat100g: 33,
    fiber100g: 0,
    sugar100g: 0.5,
    sodium100g: 621,
  }),
  nutritionFood('lettuce', 'xa lach', 'lettuce', {
    aliases: ['green lettuce'],
    category: 'vegetable',
    state: 'raw',
    calories100g: 15,
    protein100g: 1.4,
    carbs100g: 2.9,
    fat100g: 0.2,
    fiber100g: 1.3,
    sugar100g: 0.8,
    sodium100g: 28,
  }),
  nutritionFood('sugarWhite', 'duong trang', 'white sugar', {
    aliases: ['sugar', 'duong'],
    category: 'sweetener',
    state: 'unknown',
    calories100g: 387,
    protein100g: 0,
    carbs100g: 100,
    fat100g: 0,
    fiber100g: 0,
    sugar100g: 100,
    sodium100g: 1,
  }),
];

const restaurantsData: RestaurantSeed[] = [
  {
    id: seedId(3, 1),
    ownerId: foodAndBeverageOwners[0].id,
    categoryId: seedId(4, 1),
    zoneId: seedId(5, 1),
    name: 'Study Cafe & Bistro',
    description:
      'Perfect place for students to study with coffee and light meals.',
    address: 'Central Library, VNU-HCM University Village',
    phone: '0905601201',
    cuisineType: 'Cafe & Bistro',
    logoUrl: seedImages.cafeLogo.secureUrl,
    coverImageUrl: seedImages.cafeCover.secureUrl,
    latitude: TARGET_LATITUDE + 0.0003,
    longitude: TARGET_LONGITUDE + 0.0002,
    categoryName: 'Drinks & Snacks',
    items: [
      item(1, 'Iced Caffe Latte', {
        description: 'Espresso mixed with cold milk and ice.',
        price: 45000,
        itemKind: 'beverage',
        tags: [],
        imageUrl: seedImages.icedLatte.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('espresso', 'espresso', 60, 'g', 'cooked', 'main'),
          ingredient('milkWhole', 'whole milk', 150, 'g', 'unknown', 'main'),
          ingredient('sugarWhite', 'white sugar', 10, 'g', 'unknown', 'sauce'),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 10000 },
            ],
          },
          {
            name: 'Milk Option',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Whole Milk', price: 0, isDefault: true },
              { name: 'Oat Milk', price: 15000 },
              { name: 'Almond Milk', price: 15000 },
            ],
          },
          {
            name: 'Add-ons',
            minSelections: 0,
            maxSelections: 2,
            options: [
              { name: 'Extra Shot', price: 10000 },
              { name: 'Vanilla Syrup', price: 5000 },
            ],
          },
        ],
      }),
      item(2, 'Iced Matcha Latte', {
        description: 'Premium matcha with cold milk and ice.',
        price: 50000,
        itemKind: 'beverage',
        tags: [],
        imageUrl: seedImages.matchaLatte.secureUrl,
        servings: 1,
        ingredients: [
          ingredient(
            'matchaPowder',
            'matcha powder',
            5,
            'g',
            'unknown',
            'main',
          ),
          ingredient('milkWhole', 'whole milk', 180, 'g', 'unknown', 'main'),
          ingredient('sugarWhite', 'white sugar', 15, 'g', 'unknown', 'sauce'),
        ],
        modifiers: [
          {
            name: 'Size',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Medium', price: 0, isDefault: true },
              { name: 'Large', price: 12000 },
            ],
          },
          {
            name: 'Milk Option',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Whole Milk', price: 0, isDefault: true },
              { name: 'Oat Milk', price: 15000 },
            ],
          },
        ],
      }),
      item(3, 'Butter Croissant', {
        description: 'Flaky and buttery French croissant.',
        price: 35000,
        itemKind: 'food',
        tags: [dietaryTagSlugs.vegetarian],
        imageUrl: seedImages.croissant.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('croissant', 'croissant', 80, 'g', 'cooked', 'main'),
        ],
        modifiers: [
          {
            name: 'Warm Up',
            minSelections: 0,
            maxSelections: 1,
            options: [
              { name: 'Yes, warm it up', price: 0 },
              { name: 'No, keep it as is', price: 0, isDefault: true },
            ],
          },
          {
            name: 'Spreads',
            minSelections: 0,
            maxSelections: 2,
            options: [
              { name: 'Butter', price: 5000 },
              { name: 'Jam', price: 5000 },
            ],
          },
        ],
      }),
      item(4, 'Ham & Cheese Club Sandwich', {
        description: 'Classic sandwich with ham, cheddar, and fresh lettuce.',
        price: 65000,
        itemKind: 'food',
        tags: [],
        imageUrl: seedImages.clubSandwich.secureUrl,
        servings: 1,
        ingredients: [
          ingredient('breadWhite', 'white bread', 100, 'g', 'cooked', 'main'),
          ingredient('ham', 'sliced ham', 50, 'g', 'cooked', 'main'),
          ingredient(
            'cheeseCheddar',
            'cheddar cheese',
            30,
            'g',
            'unknown',
            'main',
          ),
          ingredient('lettuce', 'lettuce', 20, 'g', 'raw', 'main'),
        ],
        modifiers: [
          {
            name: 'Bread Toasting',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { name: 'Toasted', price: 0, isDefault: true },
              { name: 'Not Toasted', price: 0 },
            ],
          },
          {
            name: 'Extras',
            minSelections: 0,
            maxSelections: 3,
            options: [
              { name: 'Extra Ham', price: 15000 },
              { name: 'Extra Cheese', price: 10000 },
              { name: 'Add Egg', price: 10000 },
            ],
          },
          {
            name: 'Utensils',
            minSelections: 0,
            maxSelections: 1,
            options: [
              { name: 'No Utensils', price: 0, isDefault: true },
              { name: 'Add Utensils', price: 0 },
            ],
          },
        ],
      }),
    ],
  },
];

const restaurantSeedNames = restaurantsData.map((r) => r.name);

async function main() {
  console.log('Starting food & beverage restaurants seeding...');

  await cleanupExistingSeedData();
  await seedOwnerAccounts();
  await seedImageRecords();

  const foodIdsByKey = await seedNutritionFoodDatabase();

  for (const restaurant of restaurantsData) {
    await seedRestaurant(restaurant);
    await seedDeliveryZone(restaurant);
    await seedMenuCategory(restaurant);

    for (const menuItem of restaurant.items) {
      await seedMenuItem(restaurant, menuItem);
      await seedMenuItemNutrition(restaurant, menuItem, foodIdsByKey);
    }
  }

  console.log('Food & beverage restaurants seeding completed.');
  process.exit(0);
}

async function cleanupExistingSeedData() {
  console.log('Cleaning up existing food & beverage seed data...');

  const ownerIds = foodAndBeverageOwners.map((owner) => owner.id);
  const existingRestaurants = await db
    .select({ id: schema.restaurants.id })
    .from(schema.restaurants)
    .where(
      or(
        inArray(schema.restaurants.ownerId, ownerIds),
        inArray(schema.restaurants.name, restaurantSeedNames),
      ),
    );

  if (existingRestaurants.length > 0) {
    const restaurantIds = existingRestaurants.map((r) => r.id);

    await db
      .delete(schema.orderingMenuItemSnapshots)
      .where(
        inArray(schema.orderingMenuItemSnapshots.restaurantId, restaurantIds),
      );
    await db
      .delete(schema.orderingDeliveryZoneSnapshots)
      .where(
        inArray(
          schema.orderingDeliveryZoneSnapshots.restaurantId,
          restaurantIds,
        ),
      );
    await db
      .delete(schema.orderingRestaurantSnapshots)
      .where(
        inArray(schema.orderingRestaurantSnapshots.restaurantId, restaurantIds),
      );
    await db
      .delete(schema.notificationRestaurantSnapshots)
      .where(
        inArray(
          schema.notificationRestaurantSnapshots.restaurantId,
          restaurantIds,
        ),
      );
    await db
      .delete(schema.restaurants)
      .where(inArray(schema.restaurants.id, restaurantIds));
  }

  await db
    .delete(schema.account)
    .where(inArray(schema.account.userId, ownerIds));
  await db.delete(schema.user).where(inArray(schema.user.id, ownerIds));
  await db.delete(schema.images).where(
    inArray(
      schema.images.publicId,
      foodAndBeverageImages.map((asset) => asset.publicId),
    ),
  );
}

async function seedOwnerAccounts() {
  const now = new Date();
  for (const owner of foodAndBeverageOwners) {
    const passwordHash = await hashPassword(owner.password);
    await db.insert(schema.user).values({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      emailVerified: true,
      role: 'restaurant',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.account).values({
      id: owner.accountId,
      accountId: owner.id,
      providerId: 'credential',
      userId: owner.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Seeded owner account: ${owner.email}`);
  }
}

async function seedImageRecords() {
  await db.insert(schema.images).values(foodAndBeverageImages);
  console.log(`Seeded ${foodAndBeverageImages.length} image records.`);
}

async function seedNutritionFoodDatabase(): Promise<Map<string, string>> {
  const rows = await db
    .insert(schema.nutritionFoods)
    .values(
      nutritionFoodSeeds.map((food) => ({
        nameVi: food.nameVi,
        nameEn: food.nameEn,
        source: 'FOOD_AND_BEVERAGE_RESTAURANTS_SEED',
        sourceFoodId: nutritionFoodSourceId(food.key),
        aliases: buildAliases(food.nameVi, [food.nameEn, ...food.aliases]),
        category: food.category,
        state: food.state,
        calories100g: food.calories100g,
        protein100g: food.protein100g,
        carbs100g: food.carbs100g,
        fat100g: food.fat100g,
        fiber100g: food.fiber100g,
        sugar100g: food.sugar100g,
        sodium100g: food.sodium100g,
      })),
    )
    .onConflictDoUpdate({
      target: [schema.nutritionFoods.nameVi, schema.nutritionFoods.state],
      set: {
        nameEn: sql`excluded.name_en`,
        source: sql`excluded.source`,
        sourceFoodId: sql`excluded.source_food_id`,
        aliases: sql`excluded.aliases`,
        category: sql`excluded.category`,
        calories100g: sql`excluded.calories_100g`,
        protein100g: sql`excluded.protein_100g`,
        carbs100g: sql`excluded.carbs_100g`,
        fat100g: sql`excluded.fat_100g`,
        fiber100g: sql`excluded.fiber_100g`,
        sugar100g: sql`excluded.sugar_100g`,
        sodium100g: sql`excluded.sodium_100g`,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: schema.nutritionFoods.id,
      sourceFoodId: schema.nutritionFoods.sourceFoodId,
    });

  const foodIdsByKey = new Map<string, string>();
  for (const row of rows) {
    const key = row.sourceFoodId?.replace('food-and-beverage-restaurants:', '');
    if (key) foodIdsByKey.set(key, row.id);
  }

  await seedNutritionFoodLocalizations(foodIdsByKey);
  console.log(`Seeded ${rows.length} nutrition food rows.`);

  return foodIdsByKey;
}

async function seedNutritionFoodLocalizations(
  foodIdsByKey: Map<string, string>,
) {
  const localizationRows = nutritionFoodSeeds.flatMap((food) => {
    const nutritionFoodId = foodIdsByKey.get(food.key);
    if (!nutritionFoodId) return [];
    return [
      {
        nutritionFoodId,
        locale: 'vi',
        name: food.nameVi,
        aliases: buildAliases(food.nameVi, food.aliases),
      },
      {
        nutritionFoodId,
        locale: 'en',
        name: food.nameEn,
        aliases: buildAliases(food.nameEn, food.aliases),
      },
    ];
  });

  if (localizationRows.length === 0) return;

  await db
    .insert(schema.nutritionFoodLocalizations)
    .values(localizationRows)
    .onConflictDoUpdate({
      target: [
        schema.nutritionFoodLocalizations.nutritionFoodId,
        schema.nutritionFoodLocalizations.locale,
      ],
      set: {
        name: sql`excluded.name`,
        aliases: sql`excluded.aliases`,
        updatedAt: new Date(),
      },
    });
}

async function seedRestaurant(restaurant: RestaurantSeed) {
  await db.insert(schema.restaurants).values({
    id: restaurant.id,
    ownerId: restaurant.ownerId,
    name: restaurant.name,
    description: restaurant.description,
    address: restaurant.address,
    phone: restaurant.phone,
    isOpen: true,
    isApproved: true,
    cuisineType: restaurant.cuisineType,
    logoUrl: restaurant.logoUrl,
    coverImageUrl: restaurant.coverImageUrl,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
  });

  await db.insert(schema.orderingRestaurantSnapshots).values({
    restaurantId: restaurant.id,
    name: restaurant.name,
    isOpen: true,
    isApproved: true,
    address: restaurant.address,
    cuisineType: restaurant.cuisineType,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    ownerId: restaurant.ownerId,
  });

  await db.insert(schema.notificationRestaurantSnapshots).values({
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    name: restaurant.name,
  });

  console.log(`Seeded restaurant: ${restaurant.name}`);
}

async function seedDeliveryZone(restaurant: RestaurantSeed) {
  const zone = {
    id: restaurant.zoneId,
    restaurantId: restaurant.id,
    name: 'VNU-HCM University Village delivery zone',
    radiusKm: 4,
    baseFee: 10000,
    perKmRate: 3500,
    avgSpeedKmh: 25,
    prepTimeMinutes: 10,
    bufferMinutes: 5,
    isActive: true,
  };

  await db.insert(schema.deliveryZones).values(zone);
  await db.insert(schema.orderingDeliveryZoneSnapshots).values({
    zoneId: zone.id,
    restaurantId: zone.restaurantId,
    name: zone.name,
    radiusKm: zone.radiusKm,
    baseFee: zone.baseFee,
    perKmRate: zone.perKmRate,
    avgSpeedKmh: zone.avgSpeedKmh,
    prepTimeMinutes: zone.prepTimeMinutes,
    bufferMinutes: zone.bufferMinutes,
    isActive: zone.isActive,
    isDeleted: false,
  });
}

async function seedMenuCategory(restaurant: RestaurantSeed) {
  await db.insert(schema.menuCategories).values({
    id: restaurant.categoryId,
    restaurantId: restaurant.id,
    name: restaurant.categoryName,
    displayOrder: 1,
  });
}

async function seedMenuItem(
  restaurant: RestaurantSeed,
  menuItem: MenuItemSeed,
) {
  await db.insert(schema.menuItems).values({
    id: menuItem.id,
    restaurantId: restaurant.id,
    categoryId: restaurant.categoryId,
    name: menuItem.name,
    description: menuItem.description,
    price: menuItem.price,
    itemKind: menuItem.itemKind,
    tags: menuItem.tags,
    imageUrl: menuItem.imageUrl,
  });

  const modifierSnapshots: import('../../module/ordering/acl/schemas/menu-item-snapshot.schema').OrderingMenuItemSnapshot['modifiers'] =
    [];

  if (menuItem.modifiers && menuItem.modifiers.length > 0) {
    let groupDisplayOrder = 0;
    for (const group of menuItem.modifiers) {
      const groupId = randomUUID();
      await db.insert(schema.modifierGroups).values({
        id: groupId,
        menuItemId: menuItem.id,
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        displayOrder: groupDisplayOrder++,
      });

      const optionSnapshots: import('../../shared/events/menu-item-updated.event').ModifierOptionSnapshot[] =
        [];
      let optionDisplayOrder = 0;
      for (const option of group.options) {
        const optionId = randomUUID();
        await db.insert(schema.modifierOptions).values({
          id: optionId,
          groupId: groupId,
          name: option.name,
          price: option.price,
          isDefault: option.isDefault ?? false,
          isAvailable: true,
          displayOrder: optionDisplayOrder++,
        });
        optionSnapshots.push({
          optionId,
          name: option.name,
          price: option.price,
          isDefault: option.isDefault ?? false,
          isAvailable: true,
        });
      }
      modifierSnapshots.push({
        groupId,
        groupName: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        options: optionSnapshots,
      });
    }
  }

  await db.insert(schema.orderingMenuItemSnapshots).values({
    menuItemId: menuItem.id,
    restaurantId: restaurant.id,
    name: menuItem.name,
    price: menuItem.price,
    status: 'available',
    modifiers: modifierSnapshots,
  });
}

async function seedMenuItemNutrition(
  restaurant: RestaurantSeed,
  menuItem: MenuItemSeed,
  foodIdsByKey: Map<string, string>,
) {
  const recipe = buildExtractedRecipe(menuItem);
  const nutrition = calculateNutrition(menuItem);

  await db.insert(schema.nutritionAnalysisSessions).values({
    id: menuItem.analysisSessionId,
    menuItemId: menuItem.id,
    restaurantId: restaurant.id,
    inputType: 'text',
    rawRecipeText: buildRecipeText(menuItem),
    aiExtractedJson: recipe,
    status: 'SAVED',
  });

  await db.insert(schema.nutritionAnalysisIngredients).values(
    menuItem.ingredients.map((ingredientSeed) => ({
      analysisSessionId: menuItem.analysisSessionId,
      rawText: buildIngredientRawText(ingredientSeed),
      extractedName: ingredientSeed.name,
      correctedName: ingredientSeed.name,
      quantity: ingredientSeed.quantity,
      unit: ingredientSeed.unit,
      quantityGram: ingredientSeed.quantityGram,
      matchedNutritionFoodId: requireFoodId(
        foodIdsByKey,
        ingredientSeed.foodKey,
      ),
      confidence: 1,
      requiresConfirmation: false,
      notes: [],
    })),
  );

  await db
    .insert(schema.menuItemNutrition)
    .values({
      menuItemId: menuItem.id,
      servings: menuItem.servings,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      fiber: nutrition.fiber,
      sugar: nutrition.sugar,
      sodium: nutrition.sodium,
      source: 'VERIFIED_BY_RESTAURANT',
      verifiedByRestaurant: true,
    })
    .onConflictDoUpdate({
      target: schema.menuItemNutrition.menuItemId,
      set: {
        servings: menuItem.servings,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber,
        sugar: nutrition.sugar,
        sodium: nutrition.sodium,
        source: 'VERIFIED_BY_RESTAURANT',
        verifiedByRestaurant: true,
        updatedAt: new Date(),
      },
    });
}

function nutritionFood(
  key: string,
  nameVi: string,
  nameEn: string,
  details: Omit<NutritionFoodSeed, 'key' | 'nameVi' | 'nameEn'>,
): NutritionFoodSeed {
  return { key, nameVi, nameEn, ...details };
}

function item(
  index: number,
  name: string,
  details: Omit<
    MenuItemSeed,
    'id' | 'analysisSessionId' | 'name' | 'itemKind'
  > & {
    itemKind?: 'food' | 'beverage' | 'mixed';
  },
): MenuItemSeed {
  return {
    id: seedId(6, index),
    analysisSessionId: seedId(7, index),
    name,
    itemKind: details.itemKind ?? 'food',
    modifiers: details.modifiers ?? [],
    ...details,
  };
}

function ingredient(
  foodKey: string,
  name: string,
  quantityGram: number,
  unit: NutritionUnit,
  preparation: PreparationState,
  category: IngredientCategory,
): RecipeIngredientSeed {
  return {
    foodKey,
    name,
    canonicalNameEn: nutritionFoodByKey(foodKey).nameEn,
    quantity: quantityGram,
    unit,
    quantityGram,
    preparation,
    category,
  };
}

function nutritionFoodByKey(key: string): NutritionFoodSeed {
  const food = nutritionFoodSeeds.find((candidate) => candidate.key === key);
  if (!food) throw new Error(`Missing nutrition food seed for key: ${key}`);
  return food;
}

function nutritionFoodSourceId(key: string): string {
  return `food-and-beverage-restaurants:${key}`;
}

function requireFoodId(foodIdsByKey: Map<string, string>, key: string): string {
  const id = foodIdsByKey.get(key);
  if (!id) throw new Error(`Missing nutrition food id for key: ${key}`);
  return id;
}

function calculateNutrition(menuItem: MenuItemSeed): NutritionAmount {
  const total = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };

  for (const ingredientSeed of menuItem.ingredients) {
    const food = nutritionFoodByKey(ingredientSeed.foodKey);
    const factor = ingredientSeed.quantityGram / 100;
    total.calories += food.calories100g * factor;
    total.protein += food.protein100g * factor;
    total.carbs += food.carbs100g * factor;
    total.fat += food.fat100g * factor;
    total.fiber += food.fiber100g * factor;
    total.sugar += food.sugar100g * factor;
    total.sodium += food.sodium100g * factor;
  }

  return roundNutritionAmount({
    calories: total.calories / menuItem.servings,
    protein: total.protein / menuItem.servings,
    carbs: total.carbs / menuItem.servings,
    fat: total.fat / menuItem.servings,
    fiber: total.fiber / menuItem.servings,
    sugar: total.sugar / menuItem.servings,
    sodium: total.sodium / menuItem.servings,
  });
}

function roundNutritionAmount(amount: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}): NutritionAmount {
  return {
    calories: Math.round(amount.calories),
    protein: roundMacro(amount.protein),
    carbs: roundMacro(amount.carbs),
    fat: roundMacro(amount.fat),
    fiber: roundMacro(amount.fiber),
    sugar: roundMacro(amount.sugar),
    sodium: Math.round(amount.sodium),
  };
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildExtractedRecipe(menuItem: MenuItemSeed): ExtractedRecipe {
  return {
    recipeName: menuItem.name,
    servings: menuItem.servings,
    ingredients: menuItem.ingredients.map((ingredientSeed) => ({
      rawText: buildIngredientRawText(ingredientSeed),
      name: ingredientSeed.name,
      canonicalNameEn: ingredientSeed.canonicalNameEn,
      canonicalNameConfidence: 1,
      quantity: ingredientSeed.quantity,
      unit: ingredientSeed.unit,
      preparation: ingredientSeed.preparation,
      category: ingredientSeed.category,
      confidence: 1,
      requiresConfirmation: false,
      notes: [],
    })),
    warnings: [],
  };
}

function buildRecipeText(menuItem: MenuItemSeed): string {
  return [
    `${menuItem.name} (${menuItem.servings} serving)`,
    ...menuItem.ingredients.map(buildIngredientRawText),
  ].join('\n');
}

function buildIngredientRawText(ingredientSeed: RecipeIngredientSeed): string {
  return `${ingredientSeed.quantity} ${ingredientSeed.unit} ${ingredientSeed.name}`;
}

function buildAliases(name: string, aliases: readonly string[]): string[] {
  const values = new Set<string>();
  for (const value of [name, ...aliases]) {
    const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleaned.length >= 2) values.add(cleaned);
  }
  return Array.from(values).slice(0, 16);
}

main().catch((error) => {
  console.error('Food & Beverage restaurants seed failed:', error);
  process.exit(1);
});
