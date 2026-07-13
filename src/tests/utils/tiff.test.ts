import { describe, expect, it } from 'vitest';
import { encodeTiff } from '../../utils/tiff';

function makeImg(w: number, h: number, data?: Uint8ClampedArray) {
  return { width: w, height: h, data: data ?? new Uint8ClampedArray(w * h * 4) } as unknown as ImageData;
}

describe('TIFF encoder', () => {
  it('produces a valid TIFF header', () => {
    const buf = encodeTiff(makeImg(1, 1));

    expect(buf[0]).toBe(0x49);
    expect(buf[1]).toBe(0x49);
    expect(buf[2]).toBe(42);
    expect(buf[3]).toBe(0);
  });

  it('encodes correct dimensions', () => {
    const buf = encodeTiff(makeImg(100, 50));

    const view = new DataView(buf.buffer);
    const ifdOffset = view.getUint32(4, true);
    const entryCount = view.getUint16(ifdOffset, true);

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
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]);
    const data = makeImg(2, 2, pixels);
    const buf = encodeTiff(data);

    const pixelOffset = 170;
    const out = buf.slice(pixelOffset);

    expect(out.length).toBe(12);

    expect(out[0]).toBe(255);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);

    expect(out[3]).toBe(0);
    expect(out[4]).toBe(255);
    expect(out[5]).toBe(0);
  });

  it('produces a downloadable blob', () => {
    const buf = encodeTiff(makeImg(10, 10));
    const blob = new Blob([buf], { type: 'image/tiff' });
    expect(blob.size).toBeGreaterThan(100);
    expect(blob.type).toBe('image/tiff');
  });
});
