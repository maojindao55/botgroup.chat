import { getRoom, json } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const { roomId, playerId, content } = await context.request.json() as {
      roomId: string;
      playerId: string;
      content: string;
    };
    if (!roomId || !playerId || !content?.trim()) return json({ success: false, message: '缺少必要参数' }, 400);
    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);
    if (room.status !== 'playing') return json({ success: false, message: '当前不能发言' }, 400);
    if (String(room.title || '').startsWith('卧底晋级赛')) {
      const expired = await db.prepare(
        `SELECT 1 as expired
         WHERE datetime(?, '+' || ? || ' seconds') <= CURRENT_TIMESTAMP`
      ).bind(room.started_at, room.duration_seconds).first();
      if (expired) return json({ success: false, message: '本关已超时，挑战失败' }, 400);
    }

    const player = await db.prepare(
      `SELECT id, display_name, player_type, eliminated_at FROM ai_game_players WHERE id = ? AND room_id = ?`
    ).bind(playerId, roomId).first();
    if (!player) return json({ success: false, message: '玩家不存在' }, 404);
    if (player.eliminated_at) return json({ success: false, message: '你已出局，不能继续发言' }, 403);
    if (player.player_type !== 'human') return json({ success: false, message: '围观者不能发言' }, 403);

    const result = await db.prepare(
      `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
       VALUES (?, ?, ?, 'human', ?, CURRENT_TIMESTAMP)`
    ).bind(roomId, playerId, player.display_name, content.trim().slice(0, 500)).run();

    return json({ success: true, data: { messageId: result.meta.last_row_id } });
  } catch (error: any) {
    console.error('ai-game send error:', error);
    return json({ success: false, message: error.message || '发送失败' }, 500);
  }
};
