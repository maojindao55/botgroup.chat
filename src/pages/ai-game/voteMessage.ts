import type { GamePlayer } from './types';

export interface VotePair {
  voter: string;
  target: string;
}

export interface ParsedVoteResultMessage {
  votes: VotePair[];
  eliminatedName: string | null;
  resultLines: string[];
}

function parseUndercoverRole(raw?: string | null) {
  if (!raw?.startsWith('undercover|')) return null;
  const rolePart = raw.split('|').find((part) => part.startsWith('role='));
  return rolePart?.slice('role='.length) || null;
}

export function parseVoteResultMessage(content: string): ParsedVoteResultMessage {
  const votePart = content.match(/投票完成：(.*?)。/)?.[1] || '';
  const resultPart = content.replace(/投票完成：.*?。/, '').replace(/^投票完成：/, '');
  const eliminatedName = resultPart.match(/多数票投出\s*([^，。]+)/)?.[1]?.trim() || null;

  return {
    votes: votePart.split(/[，,]/).map((item) => {
      const match = item.trim().match(/^(.+?)\s*->\s*(.+)$/);
      return match ? { voter: match[1].trim(), target: match[2].trim() } : null;
    }).filter(Boolean) as VotePair[],
    eliminatedName,
    resultLines: resultPart.split('。').map((line) => line.trim()).filter(Boolean),
  };
}

export function getPlayerRoleLabel({
  player,
  isUndercoverMode,
}: {
  player?: Pick<GamePlayer, 'display_name' | 'secret_role' | 'ai_persona'> | null;
  isUndercoverMode: boolean;
}) {
  if (!player) return null;
  if (isUndercoverMode) return parseUndercoverRole(player.ai_persona) === 'undercover' ? '卧底' : '平民';
  if (player.secret_role === 'ai') return 'AI';
  if (player.secret_role === 'observer') return '观察者';
  return '真人';
}
