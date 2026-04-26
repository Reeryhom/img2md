export const RETRYABLE_ERRORS = [429, 500, 502, 503, 504];

export const DEFAULT_PROMPT =
  'Please describe this image in markdown format. Include all relevant details, text content, and structure.';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

export function maskString(str: string): string {
  if (!str) return '(not set)';
  if (str.length <= 8) return '********';
  return str.substring(0, 4) + '****' + str.substring(str.length - 4);
}

export async function retryRequest<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    retryable: (err: unknown) => boolean;
  },
  attempt = 0
): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (options.retryable(error) && attempt < options.maxRetries) {
      await sleep(options.baseDelayMs * Math.pow(2, attempt));
      return retryRequest(fn, options, attempt + 1);
    }
    throw error;
  }
}
