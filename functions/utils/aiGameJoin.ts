export type AiGameJoinRequest = 'player' | 'observer';
export type AiGameJoinPlayerType = 'human' | 'observer';

export function resolveAiGameJoinType({
  requested,
  roomStatus,
}: {
  requested?: AiGameJoinRequest;
  roomStatus: string;
}): {
  playerType: AiGameJoinPlayerType;
  downgraded: boolean;
  message?: string;
} {
  if (requested === 'observer') {
    return { playerType: 'observer', downgraded: false };
  }

  if (roomStatus !== 'waiting') {
    return {
      playerType: 'observer',
      downgraded: true,
      message: '游戏已开始，已切换为围观模式',
    };
  }

  return { playerType: 'human', downgraded: false };
}
