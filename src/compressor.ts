import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|tiff?|avif)$/i;

export interface CompressionResult {
  buffer: Buffer;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(
  inputPath: string,
  maxSizeMB: number = 5,
  quality: number = 80
): Promise<CompressionResult> {
  const maxBytes = maxSizeMB * 1024 * 1024;
  const originalSize = (await fs.promises.stat(inputPath)).size;

  if (originalSize <= maxBytes) {
    const buffer = await fs.promises.readFile(inputPath);
    return { buffer, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  const meta = await sharp(inputPath).metadata();
  const originalWidth = meta.width || 1920;

  let buffer = await sharp(inputPath)
    .resize(Math.round(originalWidth * Math.sqrt(maxBytes / (originalSize))))
    .jpeg({ quality, progressive: true })
    .toBuffer();

  return {
    buffer,
    wasCompressed: true,
    originalSize,
    compressedSize: buffer.length,
  };
}

export function getImageFiles(patterns: string[]): string[] {
  const files: string[] = [];
  const processedDirs = new Set<string>();

  for (const pattern of patterns) {
    if (pattern.includes('*') || pattern.includes('?')) {
      // It's a glob pattern
      files.push(...globSync(pattern).filter(f => IMAGE_EXTENSIONS.test(f)));
    } else {
      try {
        const stat = fs.statSync(pattern);
        if (stat.isDirectory()) {
          if (!processedDirs.has(pattern)) {
            processedDirs.add(pattern);
            const dirFiles = fs.readdirSync(pattern)
              .filter(f => IMAGE_EXTENSIONS.test(f))
              .map(f => path.join(pattern, f));
            files.push(...dirFiles);
          }
        } else if (IMAGE_EXTENSIONS.test(pattern)) {
          files.push(pattern);
        }
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  return [...new Set(files)];
}
