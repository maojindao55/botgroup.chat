export interface VoteTallyResult {
  targetId: string | null;
  topVotes: number;
  tiedTargetIds: string[];
}

export function resolveUniqueTopVote(votes: Array<{ target_player_id?: string | null }>): VoteTallyResult {
  const tally = new Map<string, number>();
  votes.forEach((vote) => {
    if (!vote.target_player_id) return;
    tally.set(vote.target_player_id, (tally.get(vote.target_player_id) || 0) + 1);
  });

  let topVotes = 0;
  for (const count of tally.values()) topVotes = Math.max(topVotes, count);
  const tiedTargetIds = Array.from(tally.entries())
    .filter(([, count]) => count === topVotes)
    .map(([targetId]) => targetId);

  return {
    targetId: tiedTargetIds.length === 1 ? tiedTargetIds[0] : null,
    topVotes,
    tiedTargetIds,
  };
}
