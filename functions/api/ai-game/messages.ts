import { ensurePlayerHeartbeat, json } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const url = new URL(context.request.url);
    const roomId = url.searchParams.get('room');
    const since = Number(url.searchParams.get('since') || 0);
    const playerId = url.searchParams.get('player') || undefined;
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
    if (!roomId) return json({ success: false, message: '缺少 room 参数' }, 400);

    await ensurePlayerHeartbeat(db, playerId);
    const messages = await db.prepare(
      `SELECT id, room_id, player_id, sender_name, sender_type, content, created_at
       FROM ai_game_messages
       WHERE room_id = ? AND id > ?
       ORDER BY id ASC
       LIMIT ?`
    ).bind(roomId, since, limit).all();

    return json({ success: true, data: { messages: messages.results || [] } });
  } catch (error: any) {
    console.error('ai-game messages error:', error);
    return json({ success: false, message: error.message || '获取消息失败' }, 500);
  }
};
