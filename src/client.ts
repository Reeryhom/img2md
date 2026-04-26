import Anthropic from '@anthropic-ai/sdk';
import type { Config } from './types';
import { RETRYABLE_ERRORS, DEFAULT_PROMPT, retryRequest } from './utils';

export class AnthropicClient {
  private client: Anthropic;
  private config: Required<Config>['anthropic'];

  constructor(config: Required<Config>['anthropic']) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.api_key,
      baseURL: config.base_url,
      timeout: config.timeout_ms ?? 30000,
    });
  }

  async imageToMarkdown(imageBuffer: Buffer, prompt?: string): Promise<string> {
    const base64Image = imageBuffer.toString('base64');
    const textPrompt = prompt || DEFAULT_PROMPT;

    const response = await retryRequest(
      () =>
        this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.max_tokens,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
                { type: 'text', text: textPrompt },
              ],
            },
          ],
        }),
      {
        maxRetries: this.config.max_retries,
        baseDelayMs: this.config.base_delay_ms,
        retryable: (err: unknown) => {
          const e = err as { status?: number; name?: string; message?: string };
          return (
            (e.status !== undefined && RETRYABLE_ERRORS.includes(e.status)) ||
            e.name === 'TimeoutError' ||
            (e.message?.includes('timeout') ?? false)
          );
        },
      }
    );

    const textContent = response.content?.find((c: unknown) => (c as { type?: string }).type === 'text') as { text?: string } | undefined;
    return textContent?.text ?? '';
  }
}
