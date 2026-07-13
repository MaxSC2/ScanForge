function isCbzFile(file: File): boolean {
  return /\.cbz$/i.test(file.name);
}

function isCbrFile(file: File): boolean {
  return /\.cbr$/i.test(file.name);
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);

function isImageName(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  crc32: number;
}

async function readZipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];

  // Find End of Central Directory record
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid CBZ file: no EOCD found');
  }

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const numEntries = view.getUint16(eocdOffset + 10, true);

  let offset = centralDirOffset;
  for (let i = 0; i < numEntries; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const crc32 = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const fileNameBytes = new Uint8Array(buffer, offset + 46, fileNameLength);
    const fileName = new TextDecoder().decode(fileNameBytes);

    if (isImageName(fileName)) {
      entries.push({
        name: fileName,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        localHeaderOffset,
        crc32,
      });
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

async function extractEntryData(
  buffer: ArrayBuffer,
  entry: ZipEntry,
): Promise<ArrayBuffer> {
  const view = new DataView(buffer);
  const fileNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraFieldLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const data = new Uint8Array(buffer, dataOffset, entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  if (entry.compressionMethod === 8) {
    const blob = new Blob([data]);
    const stream = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer();
  }

  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
}

export async function loadCbzPages(file: File): Promise<{ dataUrl: string; fileName: string; width: number; height: number }[]> {
  const buffer = await file.arrayBuffer();
  const entries = await readZipEntries(buffer);
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const pages: { dataUrl: string; fileName: string; width: number; height: number }[] = [];

  for (const entry of entries) {
    const imageData = await extractEntryData(buffer, entry);

    const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : ext === '.bmp' ? 'image/bmp' : 'image/jpeg';
    const blob = new Blob([imageData], { type: mime });
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${entry.name}`));
      img.src = dataUrl;
    });

    const baseName = entry.name.replace(/\.(png|jpg|jpeg|webp|bmp|gif)$/i, '');
    pages.push({
      dataUrl,
      fileName: baseName,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  }

  return pages;
}

export { isCbzFile, isCbrFile };
