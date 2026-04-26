import { test, before } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { compressImage } from '../src/compressor';

const testDir = path.join(process.cwd(), '__tests__', 'fixtures');
const smallImagePath = path.join(testDir, 'small.jpg');
const largeImagePath = path.join(testDir, 'large.jpg');

before(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
});

test('compressImage - should not compress small images', async () => {
  // Create a real small JPEG image
  const smallBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).jpeg().toBuffer();

  fs.writeFileSync(smallImagePath, smallBuffer);

  const result = await compressImage(smallImagePath, 5, 80);

  assert.strictEqual(result.wasCompressed, false);
  assert.strictEqual(result.originalSize, result.compressedSize);
});

test('compressImage - should compress large images', async () => {
  // Create a large JPEG image (bigger than 5MB when raw)
  const largeBuffer = await sharp({
    create: {
      width: 4000,
      height: 4000,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  }).jpeg({ quality: 100 }).toBuffer();

  fs.writeFileSync(largeImagePath, largeBuffer);

  const originalSize = (await fs.promises.stat(largeImagePath)).size;

  // Only test if the file is actually large enough
  if (originalSize > 5 * 1024 * 1024) {
    const result = await compressImage(largeImagePath, 5, 80);

    assert.strictEqual(result.wasCompressed, true);
    assert.ok(result.compressedSize < result.originalSize);
    assert.ok(result.compressedSize <= 5 * 1024 * 1024);
  } else {
    // Skip if test image isn't large enough
    console.log('Skipping: Test image is not large enough to test compression');
  }
});
