#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { Config } from './types';
import { loadConfig, applyCLIFlags, getConfigSearchPaths } from './config';
import { getImageFiles } from './compressor';
import { BatchProcessor } from './batch';
import { maskString } from './utils';

const program = new Command();

program
  .name('img2md')
  .description('Convert images to markdown using Vision API')
  .version('1.0.0');

const configCmd = new Command();
configCmd.name('config').description('Configuration commands');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    const searchPaths = getConfigSearchPaths();

    console.log('img2md Configuration\n');

    const loadedFrom = searchPaths.find(p => {
      try { return fs.statSync(p).isFile(); } catch { return false; }
    }) || 'default';
    console.log(`Config loaded from: ${loadedFrom}\n`);

    console.log('Provider:', config.provider);

    if (config.anthropic) {
      console.log('\nAnthropic:');
      console.log(`  base_url: ${config.anthropic.base_url}`);
      console.log(`  api_key: ${maskString(config.anthropic.api_key)}`);
      console.log(`  model: ${config.anthropic.model}`);
      console.log(`  max_tokens: ${config.anthropic.max_tokens}`);
    }

    if (config.minimax) {
      console.log('\nMinimax:');
      console.log(`  api_host: ${config.minimax.api_host}`);
      console.log(`  api_key: ${maskString(config.minimax.api_key)}`);
    }

    console.log('\nCompression:');
    console.log(`  enabled: ${config.compression.enabled}`);
    console.log(`  max_size_mb: ${config.compression.max_size_mb}`);
    console.log(`  quality: ${config.compression.quality}`);

    console.log('\nRetry:');
    console.log(`  max_retries: ${config.retry.max_retries}`);
    console.log(`  base_delay_ms: ${config.retry.base_delay_ms}`);
    console.log(`  timeout_ms: ${config.retry.timeout_ms}`);

    console.log('\nOutput:');
    console.log(`  format: ${config.output.format}`);
    console.log('');
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    const validKeys = ['provider'];
    const validValues: Record<string, string[]> = {
      provider: ['anthropic', 'minimax'],
    };

    if (!validKeys.includes(key)) {
      console.error(`Error: Invalid key '${key}'. Valid keys: ${validKeys.join(', ')}`);
      process.exit(1);
    }

    if (validValues[key] && !validValues[key].includes(value)) {
      console.error(`Error: Invalid value '${value}' for '${key}'. Valid values: ${validValues[key].join(', ')}`);
      process.exit(1);
    }

    const configPath = path.join(process.env.HOME || '', '.img2md', 'settings.json');
    const configDir = path.dirname(configPath);

    fs.mkdirSync(configDir, { recursive: true });

    let config: Partial<Config> = {};
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      // start fresh if file doesn't exist or is corrupt
    }

    if (key === 'provider') {
      config.provider = value as 'anthropic' | 'minimax';
    }

    const tmpPath = configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n');
    fs.renameSync(tmpPath, configPath);
    console.log(`Updated ${key} = ${value} in ${configPath}`);
  });

program.addCommand(configCmd);

program
  .argument('<input...>', 'Image files or glob patterns')
  .option('-p, --prompt <text>', 'Prompt for image analysis')
  .option('-o, --output <path>', 'Output file or directory')
  .option('--log <file>', 'Log file path')
  .option('--max-size <mb>', 'Max image size in MB before compression', parseFloat)
  .option('--quality <n>', 'JPEG quality (1-100)', parseInt)
  .option('--provider <provider>', 'API provider: anthropic or minimax', /^(anthropic|minimax)$/i)
  .action(async (input: string[], options: Record<string, unknown>) => {
    try {
      const config = loadConfig();
      const finalConfig = applyCLIFlags(config, {
        maxSizeMB: options.maxSize as number | undefined,
        quality: options.quality as number | undefined,
        provider: options.provider as 'anthropic' | 'minimax' | undefined,
      });

      if (!options.prompt) {
        console.error('Error: -p/--prompt is required');
        process.exit(1);
      }

      if (finalConfig.provider === 'minimax') {
        if (!finalConfig.minimax?.api_key) {
          console.error('Error: Minimax API key is required. Set it in config.');
          process.exit(1);
        }
      } else {
        if (!finalConfig.anthropic?.api_key) {
          console.error('Error: Anthropic API key is required. Set it in config.');
          process.exit(1);
        }
      }

      const files = getImageFiles(input);

      if (files.length === 0) {
        console.log('No image files found.');
        return;
      }

      validateOutputPath(options.output as string | undefined, files.length);

      if (options.output) {
        const dir = files.length === 1 ? path.dirname(options.output as string) : (options.output as string);
        fs.mkdirSync(dir, { recursive: true });
      }

      const processor = new BatchProcessor(finalConfig, options.log as string | undefined, options.prompt as string);
      const results = await processor.processFiles(files, options.output as string | undefined);
      processor.printSummary(results);
      await processor.close();

      const failed = results.filter(r => !r.success).length;
      process.exit(failed > 0 ? 1 : 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Fatal error:', msg);
      process.exit(1);
    }
  });

function validateOutputPath(outputPath: string | undefined, fileCount: number): void {
  if (!outputPath) return;
  try {
    const stat = fs.statSync(outputPath);
    if (!stat.isDirectory() && fileCount > 1) {
      console.error('Error: Output must be a directory when processing multiple files.');
      process.exit(1);
    }
  } catch {
    // doesn't exist yet, which is fine
  }
}

program.parse();
