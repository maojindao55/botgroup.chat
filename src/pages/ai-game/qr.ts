const version = 4;
const size = version * 4 + 17;
const dataCodewords = 80;
const eccCodewords = 20;

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function gfMultiply(a: number, b: number) {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    if ((b & 1) !== 0) result ^= a;
    const carry = (a & 0x80) !== 0;
    a = (a << 1) & 0xff;
    if (carry) a ^= 0x1d;
    b >>>= 1;
  }
  return result;
}

function gfPow(value: number) {
  let result = 1;
  for (let i = 0; i < value; i++) result = gfMultiply(result, 2);
  return result;
}

function reedSolomonGenerator(degree: number) {
  let result = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(result.length + 1).fill(0);
    result.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, gfPow(i));
    });
    result = next;
  }
  return result;
}

function reedSolomonRemainder(data: number[]) {
  const generator = reedSolomonGenerator(eccCodewords);
  const result = new Array(eccCodewords).fill(0);
  data.forEach((value) => {
    const factor = value ^ result.shift();
    result.push(0);
    for (let i = 0; i < eccCodewords; i++) {
      result[i] ^= gfMultiply(generator[i + 1], factor);
    }
  });
  return result;
}

function encodeData(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 76) throw new Error('QR payload is too long');

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  }
  for (let pad = 0xec; codewords.length < dataCodewords; pad ^= 0xfd) codewords.push(pad);
  return [...codewords, ...reedSolomonRemainder(codewords)];
}

function createMatrix() {
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (row: number, col: number, value: boolean, reserve = true) => {
    if (row < 0 || row >= size || col < 0 || col >= size) return;
    modules[row][col] = value;
    if (reserve) reserved[row][col] = true;
  };

  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = row + r;
        const x = col + c;
        const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(y, x, dark);
      }
    }
  };

  const drawAlignment = (row: number, col: number) => {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  drawAlignment(26, 26);

  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  set(4 * version + 9, 8, true);

  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  reserved[8][8] = true;

  return { modules, reserved, set };
}

function drawFormatBits(set: (row: number, col: number, value: boolean) => void) {
  const data = (1 << 3) | 0;
  let bits = data << 10;
  for (let i = 14; i >= 10; i--) {
    if (((bits >>> i) & 1) !== 0) bits ^= 0x537 << (i - 10);
  }
  bits = (((data << 10) | bits) ^ 0x5412) & 0x7fff;

  for (let i = 0; i <= 5; i++) set(8, i, ((bits >>> i) & 1) !== 0);
  set(8, 7, ((bits >>> 6) & 1) !== 0);
  set(8, 8, ((bits >>> 7) & 1) !== 0);
  set(7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) set(14 - i, 8, ((bits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, ((bits >>> i) & 1) !== 0);
}

export function createQrSvgDataUrl(value: string) {
  const codewords = encodeData(value);
  const bits = codewords.flatMap((codeword) => Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1));
  const { modules, reserved, set } = createMatrix();
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vertical = 0; vertical < size; vertical++) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let col = right; col >= right - 1; col--) {
        if (reserved[row][col]) continue;
        const masked = (bits[bitIndex++] || 0) !== 0 !== ((row + col) % 2 === 0);
        set(row, col, masked, false);
      }
    }
    upward = !upward;
  }

  drawFormatBits((row, col, value) => set(row, col, value));

  const border = 3;
  const rects: string[] = [];
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) rects.push(`<rect x="${x + border}" y="${y + border}" width="1" height="1"/>`);
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + border * 2} ${size + border * 2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${rects.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
