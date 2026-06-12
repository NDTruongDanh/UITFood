import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const OLLAMA_PROVIDER = Symbol('OLLAMA_PROVIDER');
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';
const DEFAULT_OLLAMA_API_KEY = 'ollama';

export type OllamaProvider = ReturnType<typeof createOpenAICompatible>;

export type OllamaEndpoint =
  | {
      mode: 'openai-compatible';
      baseURL: string;
      isDirectCloud: false;
    }
  | {
      mode: 'native';
      baseURL: string;
      isDirectCloud: boolean;
    };

export interface OllamaRuntimeConfig {
  endpoint: OllamaEndpoint;
  model: string;
  apiKey: string;
}

interface RawOllamaConfig {
  baseURL?: string;
  model?: string;
  apiKey?: string;
}

const trimOrDefault = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizedPath = (url: URL) => withoutTrailingSlash(url.pathname);

const withPath = (url: URL, path: string) => {
  const copy = new URL(url.toString());
  copy.pathname = path;
  copy.search = '';
  copy.hash = '';
  return withoutTrailingSlash(copy.toString());
};

const isOllamaCloudHost = (url: URL) => url.hostname === 'ollama.com';

const resolveEndpoint = (rawBaseURL: string): OllamaEndpoint => {
  const url = new URL(rawBaseURL);
  const path = normalizedPath(url);
  const isDirectCloud = isOllamaCloudHost(url);

  if (path.endsWith('/v1')) {
    return {
      mode: 'openai-compatible',
      baseURL: withoutTrailingSlash(url.toString()),
      isDirectCloud: false,
    };
  }

  if (path.endsWith('/api')) {
    return {
      mode: 'native',
      baseURL: withoutTrailingSlash(url.toString()),
      isDirectCloud,
    };
  }

  if (path === '') {
    return {
      mode: 'native',
      baseURL: withPath(url, '/api'),
      isDirectCloud,
    };
  }

  return {
    mode: 'native',
    baseURL: withoutTrailingSlash(url.toString()),
    isDirectCloud,
  };
};

const normalizeModelForEndpoint = (model: string, endpoint: OllamaEndpoint) => {
  if (endpoint.isDirectCloud && model.endsWith('-cloud')) {
    return model.slice(0, -'-cloud'.length);
  }

  return model;
};

export const resolveOllamaRuntimeConfig = (
  raw: RawOllamaConfig,
): OllamaRuntimeConfig => {
  const endpoint = resolveEndpoint(
    trimOrDefault(raw.baseURL, DEFAULT_OLLAMA_BASE_URL),
  );
  const model = normalizeModelForEndpoint(
    trimOrDefault(raw.model, DEFAULT_OLLAMA_MODEL),
    endpoint,
  );

  return {
    endpoint,
    model,
    apiKey: trimOrDefault(raw.apiKey, DEFAULT_OLLAMA_API_KEY),
  };
};

const toOpenAICompatibleBaseURL = (endpoint: OllamaEndpoint) => {
  if (endpoint.mode === 'openai-compatible') {
    return endpoint.baseURL;
  }

  const url = new URL(endpoint.baseURL);
  const path = normalizedPath(url);

  if (path.endsWith('/api')) {
    return withPath(url, `${path.slice(0, -'/api'.length)}/v1`);
  }

  return withPath(url, `${path}/v1`);
};

export const ollamaProvider: Provider = {
  provide: OLLAMA_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): OllamaProvider => {
    const runtimeConfig = resolveOllamaRuntimeConfig({
      baseURL: config.get<string>('OLLAMA_BASE_URL'),
      apiKey: config.get<string>('OLLAMA_API_KEY'),
      model: config.get<string>('OLLAMA_MODEL'),
    });

    return createOpenAICompatible({
      name: 'ollama',
      baseURL: toOpenAICompatibleBaseURL(runtimeConfig.endpoint),
      apiKey: runtimeConfig.apiKey,
    });
  },
};
