import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, applyCLIFlags } from '../src/config';

const testConfigPath = path.join(process.cwd(), 'test-config.json');

test('loadConfig - should load config from file', () => {
  const testConfig = {
    anthropic: {
      base_url: 'https://test.com/',
      api_key: 'test-key',
      model: 'test-model',
      max_tokens: 4096,
    },
    compression: {
      enabled: true,
      max_size_mb: 10,
      quality: 90,
    },
    retry: {
      max_retries: 5,
      base_delay_ms: 2000,
      timeout_ms: 60000,
    },
    output: {
      format: 'markdown',
    },
  };

  fs.writeFileSync(testConfigPath, JSON.stringify(testConfig));

  const config = loadConfig(testConfigPath);

  // api_key and base_url can be overridden by env vars
  assert.strictEqual(config.anthropic.model, 'test-model');
  assert.strictEqual(config.anthropic.max_tokens, 4096);
  assert.strictEqual(config.compression.max_size_mb, 10);
  assert.strictEqual(config.compression.quality, 90);
  assert.strictEqual(config.retry.max_retries, 5);

  fs.unlinkSync(testConfigPath);
});

test('loadConfig - should use default values when no config file', () => {
  const config = loadConfig('/nonexistent/path/config.json');

  assert.strictEqual(config.anthropic.model, 'claude-3-5-sonnet-20241022');
  assert.strictEqual(config.anthropic.max_tokens, 8192);
  assert.strictEqual(config.compression.max_size_mb, 5);
  assert.strictEqual(config.compression.quality, 80);
});

test('applyCLIFlags - should override config with CLI flags', () => {
  const config = loadConfig();
  const overridden = applyCLIFlags(config, {
    maxSizeMB: 15,
    quality: 95,
  });

  assert.strictEqual(overridden.compression.max_size_mb, 15);
  assert.strictEqual(overridden.compression.quality, 95);
});

test('applyCLIFlags - should not modify original config', () => {
  const config = loadConfig();
  const originalMB = config.compression.max_size_mb;

  applyCLIFlags(config, { maxSizeMB: 20 });

  assert.strictEqual(config.compression.max_size_mb, originalMB);
});
