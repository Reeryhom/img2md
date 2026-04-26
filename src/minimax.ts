import axios from 'axios';
import type { Config } from './types';
import { RETRYABLE_ERRORS, DEFAULT_PROMPT, retryRequest } from './utils';

export class MinimaxClient {
  private config: Required<Config>['minimax'];

  constructor(config: (Required<Config>['minimax'])) {
    this.config = config;
  }

  async imageToMarkdown(imageBuffer: Buffer, prompt?: string): Promise<string> {
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;
    const textPrompt = prompt || DEFAULT_PROMPT;

    const response = await retryRequest(
      () =>
        axios
          .post(
            `${this.config.api_host}/v1/coding_plan/vlm`,
            { prompt: textPrompt, image_url: imageUrl },
            {
              headers: {
                Authorization: `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json',
              },
              timeout: this.config.timeout_ms ?? 30000,
            }
          )
          .then(r => r.data),
      {
        maxRetries: this.config.max_retries,
        baseDelayMs: this.config.base_delay_ms,
        retryable: (err: unknown) => {
          const e = err as { code?: string; message?: string; response?: { status?: number } };
          return (
            (e.response?.status !== undefined && RETRYABLE_ERRORS.includes(e.response.status)) ||
            e.code === 'ECONNABORTED' ||
            (e.message?.includes('timeout') ?? false)
          );
        },
      }
    );

    return response.content || '';
  }
}
