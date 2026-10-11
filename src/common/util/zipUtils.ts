/**
 * Minimal ZIP writer: STORE method (no compression), UTF-8 entry names, no zip64.
 * Fits exports of already-compressed media plus text; folders are implied by the entry paths.
 */

export type ZipEntry = {
  path: string; // forward slashes, e.g. 'folder/images/01-1.png'
  data: Uint8Array<ArrayBuffer> | string;
};


export function createZipBlob(entries: ZipEntry[], modified: Date = new Date()): Blob {
  const encoder = new TextEncoder();
  const dosTime = (modified.getHours() << 11) | (modified.getMinutes() << 5) | (modified.getSeconds() >> 1);
  const dosDate = ((modified.getFullYear() - 1980) << 9) | ((modified.getMonth() + 1) << 5) | modified.getDate();

  const localParts: Uint8Array<ArrayBuffer>[] = [];
  const centralParts: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const crc = _crc32(data);

    // local file header
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version needed
    local.setUint16(6, 0x0800, true);      // flags: UTF-8 names
    local.setUint16(8, 0, true);           // method: store
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    localParts.push(new Uint8Array(local.buffer), name, data);

    // central directory header
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);        // version made by
    central.setUint16(6, 20, true);        // version needed
    central.setUint16(8, 0x0800, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + data.length;
    if (offset > 0xffffffff)
      throw new Error('ZIP archive over 4 GiB is not supported');
  }

  // end of central directory
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, new Uint8Array(end.buffer)], { type: 'application/zip' });
}


let _crc32Table: Uint32Array | null = null;

function _crc32(data: Uint8Array): number {
  if (!_crc32Table) {
    _crc32Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      _crc32Table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    crc = _crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
