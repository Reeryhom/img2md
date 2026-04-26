export interface Config {
  provider: 'anthropic' | 'minimax';
  anthropic?: {
    base_url: string;
    api_key: string;
    model: string;
    max_tokens: number;
    max_retries: number;
    base_delay_ms: number;
    timeout_ms: number;
  };
  minimax?: {
    api_host: string;
    api_key: string;
    max_retries: number;
    base_delay_ms: number;
    timeout_ms: number;
  };
  compression: {
    enabled: boolean;
    max_size_mb: number;
    quality: number;
  };
  retry: {
    max_retries: number;
    base_delay_ms: number;
    timeout_ms: number;
  };
  output: {
    format: string;
  };
}

export interface ProcessingResult {
  inputPath: string;
  outputPath?: string;
  error?: string;
  success: boolean;
}

export interface CLIOptions {
  input: string[];
  output?: string;
  log?: string;
  maxSizeMB?: number;
  quality?: number;
  provider?: 'anthropic' | 'minimax';
}
