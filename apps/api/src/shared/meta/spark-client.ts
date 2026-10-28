import type OpenAI from 'openai';
import { toMetaError } from './meta-errors.js';
import { withRetry } from './retry-policy.js';

export interface StructuredResult<T> {
  data: T;
  usage: { prompt_tokens: number; completion_tokens: number; reasoning_tokens: number | null };
  rawText: string;
}

export class SparkClient {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async completeStructured<T>(args: {
    schemaName: string;
    jsonSchema: Record<string, unknown>;
    systemPrompt?: string;
    userText: string;
    imageDataUrls?: string[];
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    maxTokens?: number;
    parse: (value: unknown) => T;
  }): Promise<StructuredResult<T>> {
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: args.userText }];
    for (const url of args.imageDataUrls ?? []) {
      content.push({ type: 'image_url', image_url: { url } });
    }
    try {
      const rawResponse = await withRetry(() =>
        this.client.chat.completions.create({
          model: this.model,
          reasoning_effort: args.reasoningEffort ?? 'low',
          max_tokens: args.maxTokens ?? 4000,
          response_format: {
            type: 'json_schema',
            json_schema: { name: args.schemaName, schema: args.jsonSchema, strict: true },
          },
          messages: [
            { role: 'system', content: args.systemPrompt ?? 'Return only JSON that matches the provided schema.' },
            { role: 'user', content },
          ],
        } as never),
      );
      const response = rawResponse as unknown as {
        choices: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
      };
      const rawText = response.choices[0]?.message?.content ?? '';
      const parsedJson: unknown = JSON.parse(rawText);
      return {
        data: args.parse(parsedJson),
        usage: {
          prompt_tokens: response.usage?.prompt_tokens ?? 0,
          completion_tokens: response.usage?.completion_tokens ?? 0,
          reasoning_tokens: response.usage?.completion_tokens_details?.reasoning_tokens ?? null,
        },
        rawText,
      };
    } catch (error) {
      throw toMetaError(error);
    }
  }
}
