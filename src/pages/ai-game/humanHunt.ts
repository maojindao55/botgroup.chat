import type { GameMessage, GamePlayer } from './types';

export function getHumanHuntRoundMarker(messages: GameMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.sender_type !== 'system') continue;
    const freeChatMatch = message.content.match(/^第\s*(\d+)\s*轮自由讨论开始，(.+?)\s*先开场。?$/);
    if (freeChatMatch) {
      return {
        round: Number(freeChatMatch[1]) || 1,
        prompt: '',
        starterName: freeChatMatch[2].trim(),
        messageId: message.id,
      };
    }
    const promptMatch = message.content.match(/^第\s*(\d+)\s*轮题目：(.+)$/);
    if (promptMatch) {
      return {
        round: Number(promptMatch[1]) || 1,
        prompt: promptMatch[2].trim(),
        starterName: '',
        messageId: message.id,
      };
    }
  }
  return null;
}

export function getHumanHuntRoundPrompt(messages: GameMessage[]) {
  const marker = getHumanHuntRoundMarker(messages);
  return marker?.prompt ? marker : null;
}

export function getHumanHuntTurnState(players: GamePlayer[], messages: GameMessage[]) {
  const marker = getHumanHuntRoundMarker(messages);
  if (!marker) {
    return {
      round: 0,
      prompt: '',
      order: [] as GamePlayer[],
      currentSpeaker: null as GamePlayer | null,
      starter: null as GamePlayer | null,
      starterName: '',
      speechCount: 0,
      minSpeechCount: 0,
      uniqueSpeakerCount: 0,
      minUniqueSpeakerCount: 0,
      canVote: false,
      complete: false,
    };
  }
  const order = players
    .filter(player => player.player_type !== 'observer' && !player.eliminated_at)
    .sort((a, b) => {
      const seatDiff = Number(a.seat_index || 0) - Number(b.seat_index || 0);
      if (seatDiff !== 0) return seatDiff;
      return a.id.localeCompare(b.id);
    });
  const roundMessages = messages.filter(message => message.id > marker.messageId && (message.sender_type === 'human' || message.sender_type === 'ai'));
  const spokenIds = new Set(roundMessages.map(message => message.player_id));
  const starter = marker.starterName ? order.find(player => player.display_name === marker.starterName) || null : null;
  const minSpeechCount = Math.max(1, order.length);
  const minUniqueSpeakerCount = Math.max(1, Math.ceil(order.length * 0.7));
  const canVote = roundMessages.length >= minSpeechCount && spokenIds.size >= minUniqueSpeakerCount;
  return {
    round: marker.round,
    prompt: marker.prompt,
    order,
    currentSpeaker: roundMessages.length === 0 ? starter : null,
    starter,
    starterName: marker.starterName,
    speechCount: roundMessages.length,
    minSpeechCount,
    uniqueSpeakerCount: spokenIds.size,
    minUniqueSpeakerCount,
    canVote,
    complete: canVote,
  };
}
