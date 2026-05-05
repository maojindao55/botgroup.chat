export function parseChallengeLevel(search: string) {
  const value = new URLSearchParams(search).get('challenge');
  const level = Math.floor(Number(value));
  return Number.isFinite(level) && level > 0 ? level : null;
}

export function buildAiGameChallengeUrl(currentHref: string, levelNumber?: number | null) {
  const url = new URL(currentHref);
  url.pathname = '/ai-game';
  url.search = '';
  url.hash = '';
  const level = Math.floor(Number(levelNumber) || 0);
  if (level > 0) url.searchParams.set('challenge', String(level));
  return url.toString();
}
