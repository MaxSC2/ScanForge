import { describe, expect, it } from 'vitest';
import { encodeTiff } from '../../utils/tiff';

describe('TIFF encoder', () => {
  it('produces a valid TIFF header', () => {
    const data = new ImageData(1, 1);
    const buf = encodeTiff(data);

    // Byte order marker (II = little-endian)
    expect(buf[0]).toBe(0x49);
    expect(buf[1]).toBe(0x49);

    // Magic number 42
    expect(buf[2]).toBe(42);
    expect(buf[3]).toBe(0);
  });

  it('encodes correct dimensions', () => {
    const data = new ImageData(100, 50);
    const buf = encodeTiff(data);

    // Read ImageWidth at IFD entry
    const view = new DataView(buf.buffer);
    const ifdOffset = view.getUint32(4, true);
    const entryCount = view.getUint16(ifdOffset, true);

    // Find ImageWidth (tag 256) and ImageLength (tag 257)
    let width = 0;
    let height = 0;
    for (let i = 0; i < entryCount; i++) {
      const entryOff = ifdOffset + 2 + i * 12;
      const tag = view.getUint16(entryOff, true);
      const value = view.getUint32(entryOff + 8, true);
      if (tag === 256) width = value;
      if (tag === 257) height = value;
    }

    expect(width).toBe(100);
    expect(height).toBe(50);
  });

  it('encodes pixel data (RGBA to RGB)', () => {
    const canvas = new OffscreenCanvas(2, 2);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = 'lime';
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 1, 1, 1);
    ctx.fillStyle = 'white';
    ctx.fillRect(1, 1, 1, 1);

    const imageData = ctx.getImageData(0, 0, 2, 2);
    const buf = encodeTiff(imageData);

    // Pixel data starts after header + IFD + extra data
    // Header: 8 bytes
    // IFD: 2 + 11*12 + 4 = 138
    // Extra: 8 + 8 + 8 = 24
    // Total header = 8 + 138 + 24 = 170
    const pixelOffset = 170;
    const pixels = buf.slice(pixelOffset);

    // 2*2*3 = 12 bytes RGB
    expect(pixels.length).toBe(12);

    // Red pixel (0,0)
    expect(pixels[0]).toBeGreaterThan(200);
    expect(pixels[1]).toBeLessThan(50);
    expect(pixels[2]).toBeLessThan(50);

    // Green pixel (1,0)
    expect(pixels[3]).toBeLessThan(50);
    expect(pixels[4]).toBeGreaterThan(200);
    expect(pixels[5]).toBeLessThan(50);
  });

  it('produces a downloadable blob', () => {
    const data = new ImageData(10, 10);
    const blob = new Blob([encodeTiff(data)], { type: 'image/tiff' });
    expect(blob.size).toBeGreaterThan(100);
    expect(blob.type).toBe('image/tiff');
  });
});
