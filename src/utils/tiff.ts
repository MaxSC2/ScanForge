/**
 * Minimal baseline TIFF encoder (uncompressed, RGB).
 * Outputs a valid TIFF v6 file from a Canvas ImageData.
 */

interface TiffHeader {
  byteOrder: 'II' | 'MM';
  magic: 42;
  ifdOffset: number;
}

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  value: number | Uint8Array;
}

const TIFF_TAGS = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  PhotometricInterpretation: 262,
  StripOffsets: 273,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  XResolution: 282,
  YResolution: 283,
  ResolutionUnit: 296,
  SamplesPerPixel: 277,
} as const;

const TIFF_TYPES = {
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
} as const;

function writeUint16(buf: DataView, offset: number, val: number, le: boolean) {
  buf.setUint16(offset, val, le);
}

function writeUint32(buf: DataView, offset: number, val: number, le: boolean) {
  buf.setUint32(offset, val, le);
}

function writeRational(buf: DataView, offset: number, num: number, den: number, le: boolean) {
  writeUint32(buf, offset, num, le);
  writeUint32(buf, offset + 4, den, le);
}

function writeIfdEntry(buf: DataView, offset: number, entry: IfdEntry, le: boolean): number {
  writeUint16(buf, offset, entry.tag, le);
  writeUint16(buf, offset + 2, entry.type, le);
  writeUint32(buf, offset + 4, entry.count, le);

  const dataSize = entry.count * typeSize(entry.type);
  const valueOffset = offset + 8;

  if (dataSize <= 4) {
    if (typeof entry.value === 'number') {
      if (entry.type === TIFF_TYPES.SHORT) {
        writeUint16(buf, valueOffset, entry.value, le);
        writeUint16(buf, valueOffset + 2, 0, le);
      } else {
        writeUint32(buf, valueOffset, entry.value, le);
      }
    } else if (entry.value instanceof Uint8Array) {
      for (let i = 0; i < dataSize; i++) {
        buf.setUint8(valueOffset + i, entry.value[i]);
      }
      for (let i = dataSize; i < 4; i++) {
        buf.setUint8(valueOffset + i, 0);
      }
    }
    return offset + 12;
  }

  // Write data elsewhere, store pointer
  writeUint32(buf, valueOffset, entry.value as number, le);
  return offset + 12;
}

function typeSize(type: number): number {
  switch (type) {
    case TIFF_TYPES.SHORT: return 2;
    case TIFF_TYPES.LONG: return 4;
    case TIFF_TYPES.RATIONAL: return 8;
    default: return 1;
  }
}

export function encodeTiff(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  const le = true; // little-endian
  const samplesPerPixel = 3; // RGB output (alpha stripped)
  const bitsPerSample = 8;
  const stripBytes = width * height * samplesPerPixel;
  const ifdEntryCount = 11;
  const ifdSize = 2 + ifdEntryCount * 12 + 4; // count + entries + nextIFD
  const extraDataSize = 8 + 8 + 8; // XResolution + YResolution + BitsPerSample
  const ifdOffset = 8; // after header
  const extraOffset = ifdOffset + ifdSize;
  const stripOffset = extraOffset + extraDataSize;

  const totalSize = stripOffset + stripBytes;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // TIFF header
  writeUint16(view, 0, le ? 0x4949 : 0x4D4D, le); // byte order
  writeUint16(view, 2, 42, le); // magic
  writeUint32(view, 4, ifdOffset, le); // IFD offset

  // IFD entries
  let offset = ifdOffset;
  writeUint16(view, offset, ifdEntryCount, le);
  offset += 2;

  const ifdEntries: IfdEntry[] = [
    { tag: TIFF_TAGS.ImageWidth, type: TIFF_TYPES.LONG, count: 1, value: width },
    { tag: TIFF_TAGS.ImageLength, type: TIFF_TYPES.LONG, count: 1, value: height },
    { tag: TIFF_TAGS.BitsPerSample, type: TIFF_TYPES.SHORT, count: 3, value: extraOffset },
    { tag: TIFF_TAGS.Compression, type: TIFF_TYPES.SHORT, count: 1, value: 1 }, // uncompressed
    { tag: TIFF_TAGS.PhotometricInterpretation, type: TIFF_TYPES.SHORT, count: 1, value: 2 }, // RGB
    { tag: TIFF_TAGS.StripOffsets, type: TIFF_TYPES.LONG, count: 1, value: stripOffset },
    { tag: TIFF_TAGS.SamplesPerPixel, type: TIFF_TYPES.SHORT, count: 1, value: 3 },
    { tag: TIFF_TAGS.RowsPerStrip, type: TIFF_TYPES.LONG, count: 1, value: height },
    { tag: TIFF_TAGS.StripByteCounts, type: TIFF_TYPES.LONG, count: 1, value: stripBytes },
    { tag: TIFF_TAGS.XResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: extraOffset + 8 },
    { tag: TIFF_TAGS.YResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: extraOffset + 16 },
  ];

  for (const entry of ifdEntries) {
    offset = writeIfdEntry(view, offset, entry, le);
  }

  // next IFD pointer = 0
  writeUint32(view, offset, 0, le);

  // BitsPerSample data (3 SHORTs)
  writeUint16(view, extraOffset, bitsPerSample, le);
  writeUint16(view, extraOffset + 2, bitsPerSample, le);
  writeUint16(view, extraOffset + 4, bitsPerSample, le);

  // XResolution (72/1)
  writeRational(view, extraOffset + 8, 72, 1, le);

  // YResolution (72/1)
  writeRational(view, extraOffset + 16, 72, 1, le);

  // Pixel data: RGBA -> RGB (skip alpha)
  const pixels = new Uint8Array(buf, stripOffset, stripBytes);
  let outIdx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inIdx = (y * width + x) * 4;
      pixels[outIdx++] = data[inIdx];     // R
      pixels[outIdx++] = data[inIdx + 1]; // G
      pixels[outIdx++] = data[inIdx + 2]; // B
    }
  }

  return new Uint8Array(buf);
}

export function tiffBlob(imageData: ImageData): Blob {
  return new Blob([encodeTiff(imageData)], { type: 'image/tiff' });
}

export function downloadTiff(imageData: ImageData, filename = 'export.tiff') {
  const blob = tiffBlob(imageData);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
