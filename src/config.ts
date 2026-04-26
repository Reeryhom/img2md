import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';

export function getConfigSearchPaths(): string[] {
  return [
    path.join(process.env.HOME || '', '.img2md', 'settings.json'),
    path.join(process.cwd(), '.img2md', 'settings.json'),
  ];
}

export const DEFAULT_CONFIG: Config = {
  provider: 'anthropic',
  anthropic: {
    base_url: 'https://api.anthropic.com/',
    api_key: '',
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8192,
    max_retries: 3,
    base_delay_ms: 1000,
    timeout_ms: 30000,
  },
  minimax: {
    api_host: '',
    api_key: '',
    max_retries: 3,
    base_delay_ms: 1000,
    timeout_ms: 30000,
  },
  compression: {
    enabled: true,
    max_size_mb: 5,
    quality: 80,
  },
  retry: {
    max_retries: 3,
    base_delay_ms: 1000,
    timeout_ms: 30000,
  },
  output: {
    format: 'markdown',
  },
};

export function loadConfig(configPath?: string): Config {
  const searchPaths = [configPath, ...getConfigSearchPaths()].filter(Boolean) as string[];
  let config = { ...DEFAULT_CONFIG };

  for (const p of searchPaths) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(p, 'utf-8'));
      config = mergeConfig(config, fileConfig);
      break;
    } catch (e) {
      console.warn(`[img2md] Warning: failed to load config from ${p}: ${(e as Error).message}`);
    }
  }

  return config;
}

function mergeConfig(base: Config, override: Partial<Config>): Config {
  const result: Config = {
    provider: override.provider ?? base.provider,
    anthropic: base.anthropic,
    minimax: base.minimax,
    compression: { ...base.compression, ...override.compression },
    retry: { ...base.retry, ...override.retry },
    output: { ...base.output, ...override.output },
  };

  if (override.anthropic) {
    result.anthropic = { ...base.anthropic!, ...override.anthropic };
  }
  if (override.minimax) {
    result.minimax = { ...base.minimax!, ...override.minimax };
  }

  return result;
}

export function applyCLIFlags(
  config: Config,
  flags: { maxSizeMB?: number; quality?: number; provider?: 'anthropic' | 'minimax' }
): Config {
  const result = { ...config };
  if (flags.maxSizeMB !== undefined) {
    result.compression = { ...result.compression, max_size_mb: flags.maxSizeMB };
  }
  if (flags.quality !== undefined) {
    result.compression = { ...result.compression, quality: flags.quality };
  }
  if (flags.provider !== undefined) {
    result.provider = flags.provider;
  }
  return result;
}
