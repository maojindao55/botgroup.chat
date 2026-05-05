export function normalizeUndercoverCount(value: unknown, candidateCount: number) {
  const requested = Math.max(1, Math.floor(Number(value) || 1));
  if (candidateCount < 6) return 1;
  return Math.min(2, requested);
}

export function pickUndercoverIndexes(roomId: string, candidateCount: number, undercoverCount: number) {
  const count = normalizeUndercoverCount(undercoverCount, candidateCount);
  const indexes: number[] = [];
  let seed = [...roomId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  while (indexes.length < count) {
    const index = Math.abs(seed) % candidateCount;
    if (!indexes.includes(index)) indexes.push(index);
    seed = Math.imul(seed + 31, 1103515245) + 12345;
  }
  return indexes;
}

export function evaluateUndercoverRound(options: {
  eliminatedRole?: string | null;
  eliminatedIsHuman?: boolean;
  remainingRoles: Array<string | null | undefined>;
}) {
  const remainingUndercoverCount = options.remainingRoles.filter(role => role === 'undercover').length;
  const remainingCivilianCount = options.remainingRoles.filter(role => role === 'civilian').length;
  const civilianWin = remainingUndercoverCount === 0;
  const undercoverWin = Boolean(options.eliminatedIsHuman) || (remainingUndercoverCount > 0 && remainingUndercoverCount >= remainingCivilianCount);

  return {
    remainingUndercoverCount,
    remainingCivilianCount,
    civilianWin,
    undercoverWin,
    gameOver: civilianWin || undercoverWin,
  };
}

export function isPlayerVoteDirectionCorrect(humanRole?: string | null, targetRole?: string | null) {
  return humanRole === 'undercover' ? targetRole === 'civilian' : targetRole === 'undercover';
}
