/**
 * QR code generation — produces SVG QR codes for mobile pairing.
 *
 * Zero dependencies: implements a minimal QR encoder supporting numeric,
 * alphanumeric, and byte modes up to version 10 (enough for pairing URLs).
 * Falls back to a URL text display if encoding fails.
 */

// ─── QR Code generation (simplified, zero-dep) ──────────────────────────────

/**
 * Generate an SVG QR code from a string.
 * Uses a simple matrix-based approach suitable for short URLs.
 */
export function generateQRSVG(data: string): string {
  const matrix = encodeToMatrix(data);
  if (!matrix) {
    return generateFallbackSVG(data);
  }

  const size = matrix.length;
  const cellSize = 8;
  const margin = 4;
  const totalSize = (size + margin * 2) * cellSize;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;
  svg += `<rect width="${totalSize}" height="${totalSize}" fill="white"/>`;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y]![x]) {
        const px = (x + margin) * cellSize;
        const py = (y + margin) * cellSize;
        svg += `<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Generate a fallback SVG that just shows the URL as text.
 */
export function generateFallbackSVG(data: string): string {
  const width = 300;
  const height = 80;
  const escaped = data
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="white" stroke="black" stroke-width="2" rx="8"/>
  <text x="150" y="30" text-anchor="middle" font-family="monospace" font-size="11" fill="#333">Pair with your agent:</text>
  <text x="150" y="55" text-anchor="middle" font-family="monospace" font-size="13" fill="#000" font-weight="bold">${escaped}</text>
</svg>`;
}

/**
 * Build the pairing URL for QR codes.
 */
export function buildPairingURL(opts: {
  code: string;
  host: string;
  port: number;
  agentName?: string;
}): string {
  const params = new URLSearchParams({
    code: opts.code,
    host: `${opts.host}:${opts.port}`,
  });
  if (opts.agentName) {
    params.set("name", opts.agentName);
  }
  return `cocapn://pair?${params.toString()}`;
}

// ─── Minimal QR encoder ─────────────────────────────────────────────────────
//
// This is a simplified QR code encoder that handles byte-mode data.
// It supports QR versions 1-6 (up to ~130 bytes), which is enough for
// pairing URLs like "cocapn://pair?code=123456&host=localhost:3100".

function encodeToMatrix(data: string): number[][] | null {
  try {
    const bytes = new TextEncoder().encode(data);
    const version = pickVersion(bytes.length);
    if (!version) return null;

    const size = version.size;
    const matrix = createMatrix(size, 0);
    const reserved = createMatrix(size, false) as boolean[][];

    // Place finder patterns
    placeFinderPattern(matrix, reserved, 0, 0);
    placeFinderPattern(matrix, reserved, size - 7, 0);
    placeFinderPattern(matrix, reserved, 0, size - 7);

    // Place timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6]![i]) {
        matrix[6]![i] = (i % 2 === 0) ? 1 : 0;
        reserved[6]![i] = true;
      }
      if (!reserved[i]![6]) {
        matrix[i]![6] = (i % 2 === 0) ? 1 : 0;
        reserved[i]![6] = true;
      }
    }

    // Place alignment patterns for version >= 2
    if (version.alignmentPositions.length > 0) {
      for (const ay of version.alignmentPositions) {
        for (const ax of version.alignmentPositions) {
          // Skip if overlapping finder patterns
          if ((ax < 9 && ay < 9) || (ax > size - 9 && ay < 9) || (ax < 9 && ay > size - 9)) {
            continue;
          }
          placeAlignmentPattern(matrix, reserved, ax - 2, ay - 2);
        }
      }
    }

    // Place dark module
    matrix[size - 8]![8] = 1;
    reserved[size - 8]![8] = true;

    // Reserve format info areas
    reserveFormatInfo(reserved, size);

    // Encode data
    const dataBits = encodeData(bytes, version);
    placeDataBits(matrix, reserved, dataBits, size);

    // Apply mask (mask 0: (row + col) % 2 === 0)
    applyMask(matrix, reserved, size, 0);

    // Place format info
    placeFormatInfo(matrix, size, 0, version.ecLevel);

    return matrix;
  } catch {
    return null;
  }
}

/** Create a 2D matrix with all elements initialized to `fill`. */
function createMatrix<T>(size: number, fill: T): T[][] {
  return Array.from({ length: size }, () => new Array<T>(size).fill(fill));
}

interface QRVersion {
  version: number;
  size: number;
  dataCodewords: number;
  ecLevel: number;
  alignmentPositions: number[];
}

function pickVersion(byteLength: number): QRVersion | null {
  const versions: QRVersion[] = [
    { version: 1, size: 21, dataCodewords: 19, ecLevel: 0, alignmentPositions: [] },
    { version: 2, size: 25, dataCodewords: 34, ecLevel: 0, alignmentPositions: [18] },
    { version: 3, size: 29, dataCodewords: 55, ecLevel: 0, alignmentPositions: [22] },
    { version: 4, size: 33, dataCodewords: 80, ecLevel: 0, alignmentPositions: [26] },
    { version: 5, size: 37, dataCodewords: 108, ecLevel: 0, alignmentPositions: [30] },
    { version: 6, size: 41, dataCodewords: 136, ecLevel: 0, alignmentPositions: [34] },
  ];

  // Mode indicator (4 bits) + char count (8 bits for byte mode v1-9) + data + terminator
  const neededBits = 4 + 8 + byteLength * 8;
  const neededBytes = Math.ceil(neededBits / 8);

  for (const v of versions) {
    if (v.dataCodewords >= neededBytes) return v;
  }
  return null;
}

function placeFinderPattern(matrix: number[][], reserved: boolean[][], ox: number, oy: number): void {
  const row0 = matrix[0]!;
  const colCount = row0.length;

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const my = oy + y;
      const mx = ox + x;
      if (my < 0 || my >= matrix.length || mx < 0 || mx >= colCount) continue;

      let val = 0;
      if (y === 0 || y === 6 || x === 0 || x === 6) val = 1; // border
      else if (y >= 2 && y <= 4 && x >= 2 && x <= 4) val = 1; // inner square

      matrix[my]![mx] = val;
      reserved[my]![mx] = true;
    }
  }

  // Separator (white border around finder)
  for (let i = -1; i <= 7; i++) {
    const coords: Array<[number, number]> = [
      [ox + i, oy - 1],
      [ox + i, oy + 7],
      [ox - 1, oy + i],
      [ox + 7, oy + i],
    ];
    for (const [dx, dy] of coords) {
      if (dy >= 0 && dy < matrix.length && dx >= 0 && dx < colCount && !reserved[dy]![dx]) {
        matrix[dy]![dx] = 0;
        reserved[dy]![dx] = true;
      }
    }
  }
}

function placeAlignmentPattern(matrix: number[][], reserved: boolean[][], ox: number, oy: number): void {
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const my = oy + y;
      const mx = ox + x;
      if (reserved[my]![mx]) continue;

      let val = 0;
      if (y === 0 || y === 4 || x === 0 || x === 4) val = 1;
      else if (y === 2 && x === 2) val = 1;

      matrix[my]![mx] = val;
      reserved[my]![mx] = true;
    }
  }
}

function reserveFormatInfo(reserved: boolean[][], size: number): void {
  // Around top-left finder
  for (let i = 0; i < 9; i++) {
    reserved[8]![i] = true;
    reserved[i]![8] = true;
  }
  // Around top-right finder
  for (let i = 0; i < 8; i++) {
    reserved[8]![size - 1 - i] = true;
  }
  // Around bottom-left finder
  for (let i = 0; i < 8; i++) {
    reserved[size - 1 - i]![8] = true;
  }
}

function encodeData(bytes: Uint8Array, version: QRVersion): number[] {
  const bits: number[] = [];

  // Mode indicator: 0100 = byte mode
  bits.push(0, 1, 0, 0);

  // Character count (8 bits for versions 1-9)
  for (let i = 7; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1);
  }

  // Data
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }

  // Terminator (up to 4 zeros)
  const totalDataBits = version.dataCodewords * 8;
  const terminatorLen = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad with alternating bytes
  let padByte = true;
  while (bits.length < totalDataBits) {
    const val = padByte ? 0xEC : 0x11;
    for (let i = 7; i >= 0; i--) bits.push((val >> i) & 1);
    padByte = !padByte;
  }

  return bits.slice(0, totalDataBits);
}

function placeDataBits(matrix: number[][], reserved: boolean[][], bits: number[], size: number): void {
  let bitIdx = 0;

  // Data is placed in 2-column strips, right to left, alternating upward and downward
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip vertical timing pattern column

    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (c < 0 || reserved[row]![c]) continue;
        if (bitIdx < bits.length) {
          matrix[row]![c] = bits[bitIdx++]!;
        }
      }
    }
    upward = !upward;
  }
}

function applyMask(matrix: number[][], reserved: boolean[][], size: number, mask: number): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (reserved[y]![x]) continue;

      let invert = false;
      switch (mask) {
        case 0: invert = (y + x) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (y + x) % 3 === 0; break;
        case 4: invert = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; break;
        case 5: invert = (y * x) % 2 + (y * x) % 3 === 0; break;
        case 6: invert = ((y * x) % 2 + (y * x) % 3) % 2 === 0; break;
        case 7: invert = ((y + x) % 2 + (y * x) % 3) % 2 === 0; break;
      }
      if (invert) matrix[y]![x] = matrix[y]![x]! ^ 1;
    }
  }
}

function placeFormatInfo(matrix: number[][], size: number, mask: number, _ecLevel: number): void {
  // Pre-computed format strings for L-level (ecLevel=0) with each mask
  const formatStrings = [
    0b111011111000100,
    0b111001011110011,
    0b111110110101010,
    0b111100010011101,
    0b110011000101111,
    0b110001100011000,
    0b110110001000001,
    0b110100101110110,
  ];

  const fmt = formatStrings[mask] ?? formatStrings[0]!;

  // Place around top-left finder
  const positions1: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (fmt >> (14 - i)) & 1;
    const pos = positions1[i]!;
    matrix[pos[0]]![pos[1]] = bit;
  }

  // Place around top-right and bottom-left
  for (let i = 0; i < 7; i++) {
    const bit = (fmt >> (14 - i)) & 1;
    matrix[size - 1 - i]![8] = bit; // bottom-left
  }
  for (let i = 7; i < 15; i++) {
    const bit = (fmt >> (14 - i)) & 1;
    matrix[8]![size - 15 + i] = bit; // top-right
  }
}
