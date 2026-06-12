import { resolveOllamaRuntimeConfig } from './ollama.provider';

describe('resolveOllamaRuntimeConfig', () => {
  it('uses native Ollama cloud API for the direct ollama.com host', () => {
    const config = resolveOllamaRuntimeConfig({
      baseURL: 'https://ollama.com',
      model: ' gemma4:31b-cloud',
      apiKey: ' test-key ',
    });

    expect(config).toEqual({
      endpoint: {
        mode: 'native',
        baseURL: 'https://ollama.com/api',
        isDirectCloud: true,
      },
      model: 'gemma4:31b',
      apiKey: 'test-key',
    });
  });

  it('keeps /v1 URLs on the OpenAI-compatible API path', () => {
    const config = resolveOllamaRuntimeConfig({
      baseURL: 'http://localhost:11434/v1/',
      model: 'qwen2.5:7b',
      apiKey: 'ollama',
    });

    expect(config.endpoint).toEqual({
      mode: 'openai-compatible',
      baseURL: 'http://localhost:11434/v1',
      isDirectCloud: false,
    });
    expect(config.model).toBe('qwen2.5:7b');
  });

  it('maps root local Ollama hosts to native /api without changing cloud model suffixes', () => {
    const config = resolveOllamaRuntimeConfig({
      baseURL: 'http://localhost:11434',
      model: 'gpt-oss:120b-cloud',
      apiKey: 'ollama',
    });

    expect(config.endpoint).toEqual({
      mode: 'native',
      baseURL: 'http://localhost:11434/api',
      isDirectCloud: false,
    });
    expect(config.model).toBe('gpt-oss:120b-cloud');
  });
});
