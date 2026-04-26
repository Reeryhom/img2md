# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`img2md` is a CLI tool that converts images to markdown using Vision AI APIs. It supports two providers: Anthropic (Claude) and Minimax.

## Commands

```bash
npm run build   # Compile TypeScript with tsc
npm run link    # Symlink CLI globally for testing
npm test        # Run tests with tsx: node --import tsx --test __tests__/*.test.ts
```

## Architecture

- **Dual Provider**: `AnthropicClient` (src/client.ts) and `MinimaxClient` (src/minimax.ts) both implement `ImageToMarkdownClient` interface. Provider is selected via config or `--provider` flag.
- **Batch Processing**: `BatchProcessor` in src/batch.ts uses a custom semaphore pattern to limit concurrency to 3 simultaneous requests.
- **Retry Logic**: `retryRequest()` in src/utils.ts implements exponential backoff for 429/5xx/timeout errors.
- **Image Compression**: `compressImage()` in src/compressor.ts auto-compresses images exceeding `maxSizeMB` using sharp.

## Config

Config is loaded from (first-found wins):
1. CLI `--config <path>` argument
2. `~/.img2md/settings.json`
3. `./.img2md/settings.json`

See `.img2md/settings.example.json` for the schema.

## Key Files

- `src/index.ts` - CLI entry using commander.js; handles `config show/set` subcommands and main `img2md` command
- `src/batch.ts` - orchestrates concurrent image processing
- `src/client.ts` - Anthropic SDK wrapper
- `src/minimax.ts` - Minimax API client via axios
- `src/compressor.ts` - image compression and glob file finding
- `src/config.ts` - config loading
- `src/types.ts` - TypeScript interfaces
- `src/utils.ts` - retry logic and formatting helpers
