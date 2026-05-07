import { getPlayers, getRoom, insertAiPostGameReviews, json } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const { roomId, playerId } = await context.request.json() as { roomId: string; playerId?: string };
    if (!roomId) return json({ success: false, message: '缺少房间 ID' }, 400);

    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);
    if (room.status !== 'revealed' && room.status !== 'archived') {
      return json({ success: true, data: { skipped: true, reason: 'not-ended' } });
    }

    if (playerId) {
      const requester = await db.prepare(
        `SELECT id FROM ai_game_players WHERE room_id = ? AND id = ?`
      ).bind(roomId, playerId).first();
      if (!requester) return json({ success: false, message: '玩家不存在' }, 403);
    }

    const players = await getPlayers(db, roomId, true);
    const messagesResult = await db.prepare(
      `SELECT id, room_id, player_id, sender_name, sender_type, content, created_at
       FROM ai_game_messages WHERE room_id = ? ORDER BY id ASC`
    ).bind(roomId).all();
    const votesResult = await db.prepare(
      `SELECT v.*, voter.display_name as voter_name, target.display_name as target_name, target.secret_role as target_role, target.ai_persona as target_persona
       FROM ai_game_votes v
       LEFT JOIN ai_game_players voter ON voter.id = v.voter_player_id
       LEFT JOIN ai_game_players target ON target.id = v.target_player_id
       WHERE v.room_id = ?`
    ).bind(roomId).all();

    await insertAiPostGameReviews(db, context.env, room, players, messagesResult.results || [], votesResult.results || []);
    return json({ success: true });
  } catch (error: any) {
    console.error('ai-game reviews error:', error);
    return json({ success: false, message: error.message || 'AI 复盘失败' }, 500);
  }
};
