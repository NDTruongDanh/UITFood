import { z } from 'zod';
import { NUTRITION_UNITS, PREPARATION_STATES } from '../types/nutrition.types';

export const aiRecipeUnitSchema = z.enum(NUTRITION_UNITS);
export const aiRecipePreparationSchema = z.enum(PREPARATION_STATES);

export const extractedRecipeIngredientSchema = z.object({
  rawText: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: aiRecipeUnitSchema.nullable().default('unknown'),
  preparation: aiRecipePreparationSchema.nullable().default('unknown'),
  confidence: z.number().min(0).max(1),
});

export const extractedRecipeSchema = z.object({
  recipeName: z.string().min(1).nullable(),
  servings: z.number().positive().nullable(),
  ingredients: z.array(extractedRecipeIngredientSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

const nullableStringJsonSchema = {
  anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
} as const;

const nullablePositiveNumberJsonSchema = {
  anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }],
} as const;

const nullableEnumJsonSchema = <T extends readonly string[]>(values: T) =>
  ({
    anyOf: [{ type: 'string', enum: values }, { type: 'null' }],
  }) as const;

export const extractedRecipeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recipeName: nullableStringJsonSchema,
    servings: nullablePositiveNumberJsonSchema,
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rawText: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          quantity: nullablePositiveNumberJsonSchema,
          unit: nullableEnumJsonSchema(NUTRITION_UNITS),
          preparation: nullableEnumJsonSchema(PREPARATION_STATES),
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'rawText',
          'name',
          'quantity',
          'unit',
          'preparation',
          'confidence',
        ],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['recipeName', 'servings', 'ingredients', 'warnings'],
} as const;

export type AiExtractedRecipe = z.infer<typeof extractedRecipeSchema>;
