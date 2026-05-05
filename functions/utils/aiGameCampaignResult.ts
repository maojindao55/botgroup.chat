export function calculateCampaignStars(options: {
  playerGuessCorrect?: boolean;
  groupSucceeded?: boolean;
  humanRole?: string | null;
  eliminatedRole?: string | null;
  eliminatedIsHuman?: boolean;
  remainingCount?: number;
  durationSeconds?: number;
  secondsUsed?: number;
}) {
  const playerGuessCorrect = Boolean(options.playerGuessCorrect);
  const groupSucceeded = Boolean(options.groupSucceeded);
  const humanRole = options.humanRole;

  if (!playerGuessCorrect || !groupSucceeded) return 0;

  let stars = 1;
  if (
    (humanRole === 'civilian' && options.eliminatedRole === 'undercover') ||
    (humanRole === 'undercover' && !options.eliminatedIsHuman && options.eliminatedRole === 'civilian')
  ) {
    stars = 2;
  }

  const durationSeconds = Math.max(1, Number(options.durationSeconds || 0));
  const secondsUsed = Math.max(0, Number(options.secondsUsed || durationSeconds));
  if (secondsUsed <= durationSeconds * 0.6 || Number(options.remainingCount || 0) >= 5) {
    stars = 3;
  }

  return stars;
}
