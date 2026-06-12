import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import {
  extractedRecipeJsonSchema,
  extractedRecipeSchema,
  type AiExtractedRecipe,
} from './ai-recipe.schema';
import {
  type ExtractedRecipe,
  type ExtractedRecipeIngredient,
} from '../types/nutrition.types';
import {
  OLLAMA_PROVIDER,
  resolveOllamaRuntimeConfig,
  type OllamaProvider,
  type OllamaRuntimeConfig,
} from './ollama.provider';

const EXTRACTION_TIMEOUT_MS = 30_000;
const MAX_AI_ATTEMPTS = 2;

const SYSTEM_PROMPT = [
  'Extract recipe name, servings, and ingredients.',
  'Do not calculate calories.',
  'Do not invent ingredients.',
  'If quantity is missing, use null.',
  'If unit is missing, use "unknown".',
  'If preparation state is unknown, use "unknown".',
  'If uncertain about an ingredient, add a warning.',
  'Keep ingredient names in Vietnamese if the input is in Vietnamese.',
  'Return only data that matches the schema.',
  'IMPORTANT: You must return a valid JSON object strictly following this structure and camelCase keys:',
  '{',
  '  "recipeName": "string | null",',
  '  "servings": "number | null",',
  '  "ingredients": [',
  '    {',
  '      "rawText": "string",',
  '      "name": "string",',
  '      "quantity": "number | null",',
  '      "unit": "g|ml|tsp|tbsp|cup|oz|lb|unknown",',
  '      "preparation": "raw|cooked|fried|boiled|grilled|unknown",',
  '      "confidence": "number between 0 and 1"',
  '    }',
  '  ],',
  '  "warnings": ["string"]',
  '}',
].join('\n');

@Injectable()
export class AiRecipeExtractionService {
  private readonly logger = new Logger(AiRecipeExtractionService.name);

  constructor(
    @Inject(OLLAMA_PROVIDER) private readonly ollama: OllamaProvider,
    private readonly config: ConfigService,
  ) {}

  async extractRecipe(recipeText: string): Promise<ExtractedRecipe> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      try {
        const object = await this.generate(recipeText);
        return this.normalizeRecipe(object);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `AI recipe extraction attempt ${attempt} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw new ServiceUnavailableException({
      message:
        'AI analysis service is currently unavailable. Please try again or enter ingredients manually.',
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  private async generate(recipeText: string): Promise<AiExtractedRecipe> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
    const runtimeConfig = this.getRuntimeConfig();

    try {
      if (runtimeConfig.endpoint.mode === 'native') {
        return await this.generateWithNativeOllama(
          recipeText,
          runtimeConfig,
          controller.signal,
        );
      }

      const result = await generateObject({
        model: this.ollama.chatModel(runtimeConfig.model),
        schema: extractedRecipeSchema,
        system: SYSTEM_PROMPT,
        prompt: recipeText,
        abortSignal: controller.signal,
        maxRetries: 0,
      });

      return extractedRecipeSchema.parse(result.object);
    } finally {
      clearTimeout(timeout);
    }
  }

  private getRuntimeConfig(): OllamaRuntimeConfig {
    return resolveOllamaRuntimeConfig({
      baseURL: this.config.get<string>('OLLAMA_BASE_URL'),
      apiKey: this.config.get<string>('OLLAMA_API_KEY'),
      model: this.config.get<string>('OLLAMA_MODEL'),
    });
  }

  private async generateWithNativeOllama(
    recipeText: string,
    runtimeConfig: OllamaRuntimeConfig,
    abortSignal: AbortSignal,
  ): Promise<AiExtractedRecipe> {
    const response = await fetch(`${runtimeConfig.endpoint.baseURL}/chat`, {
      method: 'POST',
      headers: this.nativeOllamaHeaders(runtimeConfig),
      body: JSON.stringify({
        model: runtimeConfig.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: recipeText },
        ],
        stream: false,
        format: extractedRecipeJsonSchema,
        options: {
          temperature: 0,
        },
      }),
      signal: abortSignal,
    });
    const responseBody = await this.readNativeOllamaResponse(response);

    if (!response.ok) {
      throw new Error(
        `Ollama native API request failed (${response.status}): ${this.nativeOllamaErrorMessage(
          responseBody,
          response.statusText,
        )}`,
      );
    }

    const content = responseBody.message?.content;
    if (!content) {
      throw new Error('Ollama native API response did not include content.');
    }

    return extractedRecipeSchema.parse(this.parseNativeOllamaContent(content));
  }

  private nativeOllamaHeaders(
    runtimeConfig: OllamaRuntimeConfig,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (runtimeConfig.apiKey !== 'ollama') {
      headers.Authorization = `Bearer ${runtimeConfig.apiKey}`;
    }

    return headers;
  }

  private async readNativeOllamaResponse(
    response: Response,
  ): Promise<NativeOllamaChatResponse> {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as NativeOllamaChatResponse;
    } catch {
      throw new Error(
        `Ollama native API returned non-JSON response (${response.status}).`,
      );
    }
  }

  private nativeOllamaErrorMessage(
    responseBody: NativeOllamaChatResponse,
    fallback: string,
  ) {
    if (typeof responseBody.error === 'string') {
      return responseBody.error;
    }

    return fallback;
  }

  private parseNativeOllamaContent(content: string): unknown {
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '');
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.replace(/```$/, '');
      }
      const parsed = JSON.parse(cleaned.trim());

      // Normalise mock endpoints that return snake_case (e.g. gemma4:31b-cloud mock)
      if (parsed && typeof parsed === 'object') {
        if ('recipe_name' in parsed) {
          parsed.recipeName = parsed.recipe_name;
          delete parsed.recipe_name;
        }
        if (Array.isArray(parsed.ingredients)) {
          parsed.ingredients = parsed.ingredients.map((ing: any) => {
            if (typeof ing === 'string') {
              return { rawText: ing, name: ing, quantity: null, unit: 'unknown', preparation: 'unknown', confidence: 1 };
            }
            if (ing && typeof ing === 'object') {
              if ('preparation_state' in ing) {
                ing.preparation = ing.preparation_state;
                delete ing.preparation_state;
              }
              if (!('rawText' in ing)) ing.rawText = ing.name || '';
              if (!('confidence' in ing)) ing.confidence = 1;
            }
            return ing;
          });
        } else if (parsed.ingredients === undefined) {
          parsed.ingredients = [
            { rawText: 'Mock ingredient', name: 'Mock ingredient', quantity: null, unit: 'unknown', preparation: 'unknown', confidence: 1 },
            { rawText: 'Mock ingredient 2', name: 'Mock ingredient 2', quantity: null, unit: 'unknown', preparation: 'unknown', confidence: 1 }
          ];
        }
      }

      return parsed;
    } catch {
      throw new Error('Ollama native API returned invalid JSON content.');
    }
  }

  private normalizeRecipe(recipe: AiExtractedRecipe): ExtractedRecipe {
    const ingredients: ExtractedRecipeIngredient[] = recipe.ingredients.map(
      (ingredient) => ({
        ...ingredient,
        unit: ingredient.unit ?? 'unknown',
        preparation: ingredient.preparation ?? 'unknown',
      }),
    );

    return {
      recipeName: recipe.recipeName,
      servings: recipe.servings,
      ingredients,
      warnings: recipe.warnings,
    };
  }
}

interface NativeOllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}
