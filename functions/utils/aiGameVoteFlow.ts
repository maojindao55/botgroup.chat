export function canSubmitUndercoverVoteThisRound(options: {
  latestVoteResultId?: number | null;
  latestHumanMessageId?: number | null;
  aiMessagesAfterHuman?: number | null;
  activeAiCount?: number | null;
}) {
  const latestVoteResultId = Number(options.latestVoteResultId || 0);
  const latestHumanMessageId = Number(options.latestHumanMessageId || 0);
  const aiMessagesAfterHuman = Number(options.aiMessagesAfterHuman || 0);
  const activeAiCount = Math.max(1, Number(options.activeAiCount || 0));

  if (latestHumanMessageId <= latestVoteResultId) {
    return { allowed: false, reason: 'needs-human-message' as const };
  }

  if (aiMessagesAfterHuman < activeAiCount) {
    return { allowed: false, reason: 'needs-ai-round' as const };
  }

  return { allowed: true, reason: 'ok' as const };
}
