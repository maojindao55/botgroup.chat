export function canControlAiGameRoom(player?: { player_type?: string | null } | null) {
  return player?.player_type === 'human';
}
