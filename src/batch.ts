import * as fs from 'fs';
import * as path from 'path';
import type { Config, ProcessingResult } from './types';
import { compressImage, type CompressionResult } from './compressor';
import { AnthropicClient } from './client';
import { MinimaxClient } from './minimax';
import { formatBytes } from './utils';

interface ImageToMarkdownClient {
  imageToMarkdown(buffer: Buffer, prompt?: string): Promise<string>;
}

export class BatchProcessor {
  private config: Config;
  private client: ImageToMarkdownClient;
  private logStream?: fs.WriteStream;
  private maxConcurrent = 3;
  private prompt?: string;

  constructor(config: Config, logPath?: string, prompt?: string) {
    this.config = config;
    this.prompt = prompt;

    if (config.provider === 'minimax' && config.minimax) {
      this.client = new MinimaxClient({
        api_host: config.minimax.api_host,
        api_key: config.minimax.api_key,
        max_retries: config.minimax.max_retries,
        base_delay_ms: config.minimax.base_delay_ms,
        timeout_ms: config.minimax.timeout_ms,
      });
    } else if (config.anthropic) {
      this.client = new AnthropicClient({
        base_url: config.anthropic.base_url,
        api_key: config.anthropic.api_key,
        model: config.anthropic.model,
        max_tokens: config.anthropic.max_tokens,
        max_retries: config.anthropic.max_retries,
        base_delay_ms: config.anthropic.base_delay_ms,
        timeout_ms: config.anthropic.timeout_ms,
      });
    } else {
      throw new Error('No valid API configuration found');
    }

    if (logPath) {
      this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    }
  }

  async processFiles(files: string[], outputPath?: string): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const isBatch = files.length > 1;
    const isDirOutput = outputPath ? fs.statSync(outputPath).isDirectory() : false;
    const queue = [...files];
    const active: Promise<unknown>[] = [];

    while (queue.length > 0 || active.length > 0) {
      while (queue.length > 0 && active.length < this.maxConcurrent) {
        const file = queue.shift()!;
        const p = this.processFile(file, outputPath, isDirOutput, isBatch)
          .then(r => results.push(r))
          .catch((err: Error) => results.push({ inputPath: file, success: false, error: err.message }));
        active.push(p);
      }

      if (active.length > 0) {
        const wrapped: Promise<number>[] = active.map((p, i) => (p as Promise<void>).then(() => i));
        const finished = await Promise.race(wrapped);
        active.splice(finished, 1);
      }
    }

    await Promise.all(active);
    return results;
  }

  private async processFile(
    inputPath: string,
    outputPath: string | undefined,
    isDirOutput: boolean,
    isBatch: boolean
  ): Promise<ProcessingResult> {
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const result: ProcessingResult = { inputPath, success: false };

    try {
      this.log(`Processing: ${inputPath}`);

      const compression: CompressionResult = await compressImage(
        inputPath,
        this.config.compression.max_size_mb,
        this.config.compression.quality
      );

      if (compression.wasCompressed) {
        this.log(
          `Compressed: ${inputPath} (${formatBytes(compression.originalSize)} → ${formatBytes(compression.compressedSize)})`
        );
      }

      const markdown = await this.client.imageToMarkdown(compression.buffer, this.prompt);

      if (outputPath) {
        const outFile = isDirOutput
          ? path.join(outputPath, `${fileName}.md`)
          : outputPath;
        await fs.promises.writeFile(outFile, markdown, 'utf-8');
        result.outputPath = outFile;
      } else {
        if (isBatch) console.log(`\n========== ${fileName}.md ==========\n`);
        console.log(markdown);
      }

      result.success = true;
      this.log(`Success: ${inputPath}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.error = errorMsg;
      this.log(`ERROR: ${inputPath} - ${errorMsg}`);
      console.error(`[ERROR] ${inputPath}: ${errorMsg}`);
    }

    return result;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    if (this.logStream) this.logStream.write(line);
  }

  async close(): Promise<void> {
    if (this.logStream) this.logStream.end();
  }

  printSummary(results: ProcessingResult[]): void {
    let succeeded = 0;
    const failed: ProcessingResult[] = [];

    for (const r of results) {
      if (r.success) succeeded++;
      else failed.push(r);
    }

    console.log('\n========================================');
    console.log(`Batch complete: ${succeeded} succeeded, ${failed.length} failed`);
    console.log('========================================');

    if (failed.length > 0) {
      console.log('\nFailures:');
      for (const r of failed) {
        console.log(`  - ${r.inputPath}: ${r.error}`);
      }
    }
  }
}
