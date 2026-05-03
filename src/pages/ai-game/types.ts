import type { AiGameStatus } from '@/config/aiGame';

export interface GameRoomData {
  id: string;
  mode: string;
  status: AiGameStatus;
  title: string;
  max_players: number;
  ai_count: number;
  duration_seconds: number;
  message_limit: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface GamePlayer {
  id: string;
  room_id: string;
  display_name: string;
  player_type?: 'human' | 'ai' | 'observer';
  secret_role?: 'human' | 'ai' | 'observer';
  ai_persona?: string | null;
  seat_index: number;
  is_online: number;
  last_seen_at: string | null;
  eliminated_at?: string | null;
}

export interface GameMessage {
  id: number;
  room_id: string;
  player_id: string;
  sender_name: string;
  sender_type: 'human' | 'ai' | 'system';
  content: string;
  created_at: string;
}

export interface GameResult {
  room_id: string;
  human_accuracy: number;
  ai_escape_rate: number;
  best_disguised_player_id: string | null;
  summary: string;
  share_text: string;
}

export interface CurrentPlayerSecret {
  word?: string;
  role?: string;
}
