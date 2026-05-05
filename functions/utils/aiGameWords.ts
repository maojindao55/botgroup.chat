export function hashStringToIndex(value: string, size: number) {
  if (size <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

const simplifiedTraditionalPairs = new Set([
  '后後', '发發', '发髮', '台臺', '云雲', '里裡', '面麵', '干乾', '干幹',
  '钟鐘', '钟鍾', '复複', '复復', '尽盡', '只隻', '叶葉', '几幾', '广廣',
  '东東', '车車', '门門', '马馬', '鸟鳥', '鱼魚', '风風', '龙龍', '书書',
  '话話', '语語', '国國', '学學', '电電', '脑腦', '网網', '声聲', '乐樂',
  '灯燈', '医醫', '药藥', '饭飯', '馆館', '体體', '气氣', '画畫', '筝箏',
]);

function isSafeGeneratedWord(value: string) {
  const word = value.trim();
  if (!/^[\u4e00-\u9fa5]{1,4}$/.test(word)) return false;
  if (/政治|成人|色情|暴力|疾病|癌|药|品牌|公司|青团|汤圆|月饼|粽子|元宵|腊八/.test(word)) return false;
  return true;
}

function isSameWordVariant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let changedPair = '';
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (changedPair) return false;
    changedPair = [a[i], b[i]].sort().join('');
  }
  return Boolean(changedPair && simplifiedTraditionalPairs.has(changedPair));
}

export function makeWordPairKey(a: string, b: string) {
  return [a.trim(), b.trim()].sort().join('|');
}

export function validateGeneratedUndercoverPair(
  civilianWord: string,
  undercoverWord: string,
  usedWords = new Set<string>(),
) {
  const civilian = civilianWord.trim();
  const undercover = undercoverWord.trim();
  if (!isSafeGeneratedWord(civilian) || !isSafeGeneratedWord(undercover)) return { valid: false, reason: 'unsafe-word' };
  if (civilian === undercover) return { valid: false, reason: 'same-word' };
  if (civilian.includes(undercover) || undercover.includes(civilian)) return { valid: false, reason: 'contains-word' };
  if (isSameWordVariant(civilian, undercover)) return { valid: false, reason: 'same-word-variant' };
  if (usedWords.has(civilian) || usedWords.has(undercover)) return { valid: false, reason: 'used-word' };
  return { valid: true, reason: 'ok' };
}

export function getDynamicPairLookupOrder() {
  return ['generate', 'fresh-cache', 'stale-cache', 'fallback'] as const;
}
