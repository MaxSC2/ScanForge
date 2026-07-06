function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function buildCbzBlob(
  entries: { fileName: string; data: ArrayBuffer }[],
): Promise<Blob> {
  const chunks: BlobPart[] = [];
  const centralChunks: BlobPart[] = [];
  let offset = 0;

  for (const entry of entries) {
    const dataBytes = new Uint8Array(entry.data);
    const fileNameBytes = new TextEncoder().encode(entry.fileName);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new ArrayBuffer(30 + fileNameBytes.length);
    const view = new DataView(localHeader);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, fileNameBytes.length, true);
    view.setUint16(28, 0, true);
    new Uint8Array(localHeader, 30).set(fileNameBytes);

    chunks.push(localHeader, entry.data);

    const centralEntry = new ArrayBuffer(46 + fileNameBytes.length);
    const centralView = new DataView(centralEntry);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, fileNameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    new Uint8Array(centralEntry, 46).set(fileNameBytes);

    centralChunks.push(centralEntry);
    offset += 30 + fileNameBytes.length + size;
  }

  const centralSize = centralChunks.reduce(
    (sum, c) => sum + (c as ArrayBuffer).byteLength,
    0,
  );

  const eocd = new ArrayBuffer(22);
  const eocdView = new DataView(eocd);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  return new Blob([...chunks, ...centralChunks, eocd], {
    type: 'application/vnd.comicbook+zip',
  });
}
