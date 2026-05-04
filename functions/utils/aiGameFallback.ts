const undercoverFallbackReplies = [
  '这个一般挺常见的，日常里经常会碰到。',
  '我感觉它更偏实用，大家应该都不陌生。',
  '它通常会出现在比较普通的生活场景里。',
  '这个东西用起来不复杂，重点还是看具体场合。',
  '我觉得它和习惯有关，每个人接触频率不太一样。',
  '它不是特别稀奇，但细节上还是能分出差别。',
  '这个更像大家平时顺手会用到的东西。',
  '我会先看它的用途，再看出现的场景。',
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateUndercoverFallbackReply({
  playerId,
  word,
  messageCount,
  ownTurnCount,
}: {
  playerId: string;
  word: string;
  messageCount: number;
  ownTurnCount: number;
}) {
  const seed = [...`${playerId}:${word}:${messageCount}:${ownTurnCount}`]
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const reply = undercoverFallbackReplies[seed % undercoverFallbackReplies.length] || undercoverFallbackReplies[0];
  return reply
    .replace(new RegExp(escapeRegExp(word), 'g'), '这个东西')
    .slice(0, 90);
}
