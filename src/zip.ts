export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes)
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function zipFiles(entries: ZipEntry[]) {
  const encoded = entries.map((entry) => ({
    name: encoder.encode(entry.name),
    bytes: entry.bytes,
    checksum: crc32(entry.bytes),
  }));
  const localSize = encoded.reduce(
    (sum, entry) => sum + 30 + entry.name.length + entry.bytes.length,
    0,
  );
  const centralSize = encoded.reduce(
    (sum, entry) => sum + 46 + entry.name.length,
    0,
  );
  const result = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(result.buffer);
  let offset = 0;
  const offsets: number[] = [];
  for (const entry of encoded) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 12, 0x0021, true);
    view.setUint32(offset + 14, entry.checksum, true);
    view.setUint32(offset + 18, entry.bytes.length, true);
    view.setUint32(offset + 22, entry.bytes.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    result.set(entry.name, offset + 30);
    result.set(entry.bytes, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.bytes.length;
  }
  for (const [index, entry] of encoded.entries()) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 14, 0x0021, true);
    view.setUint32(offset + 16, entry.checksum, true);
    view.setUint32(offset + 20, entry.bytes.length, true);
    view.setUint32(offset + 24, entry.bytes.length, true);
    view.setUint16(offset + 28, entry.name.length, true);
    view.setUint32(offset + 42, offsets[index], true);
    result.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, encoded.length, true);
  view.setUint16(offset + 10, encoded.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, localSize, true);
  return result;
}
