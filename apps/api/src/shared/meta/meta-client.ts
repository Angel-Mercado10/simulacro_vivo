import OpenAI from 'openai';
import type { AppConfig } from '../../config.js';

export function createMetaClient(config: AppConfig): OpenAI {
  if (!config.modelApiKey) {
    throw new Error('MODEL_API_KEY is not configured');
  }
  return new OpenAI({ apiKey: config.modelApiKey, baseURL: config.metaBaseUrl, timeout: 30_000 });
}

export async function listModels(config: AppConfig): Promise<string[]> {
  const client = createMetaClient(config);
  const page = await client.models.list();
  return page.data.map((m) => m.id);
}
