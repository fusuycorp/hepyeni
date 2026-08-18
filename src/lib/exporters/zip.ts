/**
 * Zero-dependency standard PKZip (stored/uncompressed) builder.
 * Compatible with macOS Archive Utility, Windows Explorer, Linux unzip, Obsidian, etc.
 */

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

export function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileInput {
  name: string;
  content: string | Uint8Array;
}

export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const localHeadersAndData: Uint8Array[] = [];
  const centralDirectoryHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const filenameBytes = encoder.encode(file.name);
    const dataBytes =
      typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // 1. Local File Header (30 bytes + name + data)
    const localHeader = new Uint8Array(30 + filenameBytes.length + size);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // General purpose bit flag (Bit 11: UTF-8)
    lv.setUint16(8, 0, true); // Compression method (0 = Stored)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, filenameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length

    localHeader.set(filenameBytes, 30);
    localHeader.set(dataBytes, 30 + filenameBytes.length);

    localHeadersAndData.push(localHeader);

    // 2. Central Directory Header (46 bytes + name)
    const cdHeader = new Uint8Array(46 + filenameBytes.length);
    const cv = new DataView(cdHeader.buffer);

    cv.setUint32(0, 0x02014b50, true); // Central file header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed to extract
    cv.setUint16(8, 0x0800, true); // General purpose bit flag (UTF-8)
    cv.setUint16(10, 0, true); // Compression method
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, filenameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, offset, true); // Relative offset of local header

    cdHeader.set(filenameBytes, 46);
    centralDirectoryHeaders.push(cdHeader);

    offset += localHeader.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDirectoryHeaders) {
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central dir signature
  ev.setUint16(4, 0, true); // Disk number
  ev.setUint16(6, 0, true); // Disk where CD starts
  ev.setUint16(8, files.length, true); // Number of CD records on disk
  ev.setUint16(10, files.length, true); // Total number of CD records
  ev.setUint32(12, cdSize, true); // Size of central directory
  ev.setUint32(16, cdOffset, true); // Offset of central directory
  ev.setUint16(20, 0, true); // Comment length

  // Combine all parts
  const totalLength = offset + cdSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const part of localHeadersAndData) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const cd of centralDirectoryHeaders) {
    result.set(cd, pos);
    pos += cd.length;
  }
  result.set(eocd, pos);

  return result;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
