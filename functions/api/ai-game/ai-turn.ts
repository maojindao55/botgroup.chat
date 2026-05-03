import { generateAiGameReply, generateJuryReply, generateNpcReply, generateUndercoverReply, getRoom, json } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const { roomId } = await context.request.json() as { roomId: string };
    if (!roomId) return json({ success: false, message: '缺少房间 ID' }, 400);
    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);
    if (room.status !== 'playing') return json({ success: true, data: { replies: [] } });

    const lastAi = await db.prepare(
      `SELECT created_at FROM ai_game_messages WHERE room_id = ? AND sender_type = 'ai' ORDER BY id DESC LIMIT 1`
    ).bind(roomId).first();
    if (room.mode !== 'jury' && lastAi && Date.now() - new Date(String(lastAi.created_at) + 'Z').getTime() < 9000) {
      return json({ success: true, data: { replies: [] } });
    }

    const messagesResult = await db.prepare(
      `SELECT id, player_id, sender_name, sender_type, content, created_at
       FROM ai_game_messages WHERE room_id = ? ORDER BY id DESC LIMIT 20`
    ).bind(roomId).all();
    const messages = (messagesResult.results || []).reverse();
    if (messages.length === 0 || messages[messages.length - 1].sender_type === 'ai') {
      return json({ success: true, data: { replies: [] } });
    }

    if (room.mode === 'jury') {
      const responderResult = await db.prepare(
        `SELECT id, display_name, player_type, ai_persona FROM ai_game_players
         WHERE room_id = ? AND player_type = 'ai'
         ORDER BY RANDOM()
         LIMIT 3`
      ).bind(roomId).all();
      const replies = [];
      for (const player of responderResult.results || []) {
        const content = await generateJuryReply(context.env, player, room, messages);
        const result = await db.prepare(
          `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
           VALUES (?, ?, ?, 'ai', ?, CURRENT_TIMESTAMP)`
        ).bind(roomId, player.id, player.display_name, content).run();
        replies.push({ id: result.meta.last_row_id, playerId: player.id, content });
      }
      return json({ success: true, data: { replies } });
    }

    if (room.mode === 'undercover') {
      const responderResult = await db.prepare(
        `SELECT id, display_name, player_type, ai_persona FROM ai_game_players
         WHERE room_id = ? AND player_type = 'ai' AND eliminated_at IS NULL
         ORDER BY seat_index ASC, created_at ASC`
      ).bind(roomId).all();
      const replies = [];
      for (const player of responderResult.results || []) {
        const content = await generateUndercoverReply(context.env, player, room, messages);
        const result = await db.prepare(
          `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
           VALUES (?, ?, ?, 'ai', ?, CURRENT_TIMESTAMP)`
        ).bind(roomId, player.id, player.display_name, content).run();
        replies.push({ id: result.meta.last_row_id, playerId: player.id, content });
        messages.push({
          id: result.meta.last_row_id,
          player_id: player.id,
          sender_name: player.display_name,
          sender_type: 'ai',
          content,
          created_at: new Date().toISOString(),
        });
      }
      return json({ success: true, data: { replies } });
    }

    const recentAiCount = messages.slice(-6).filter((msg: any) => msg.sender_type === 'ai').length;
    const recentHumanCount = messages.slice(-6).filter((msg: any) => msg.sender_type === 'human').length;
    const lastMessage = messages[messages.length - 1];
    const directMention = /@|你|谁|吗|呢|咋|怎么|为什么|\?|\？/.test(String(lastMessage.content || ''));
    const shouldStayQuiet = recentAiCount >= recentHumanCount || (!directMention && Math.random() < 0.45);

    if (shouldStayQuiet) {
      return json({ success: true, data: { replies: [] } });
    }

    const responderResult = await db.prepare(
      `SELECT id, display_name, player_type, ai_persona FROM ai_game_players
       WHERE room_id = ? AND player_type IN ('ai', 'human') AND user_id IS NULL
       ORDER BY RANDOM()
       LIMIT ?`
    ).bind(roomId, room.mode === 'solo' ? 2 : 1).all();
    const responders = responderResult.results || [];
    const replies = [];

    for (const player of responders) {
      const content = player.player_type === 'ai'
        ? await generateAiGameReply(context.env, player, room, messages)
        : generateNpcReply(player, messages);
      if (!content.trim()) continue;
      const result = await db.prepare(
        `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(roomId, player.id, player.display_name, player.player_type === 'ai' ? 'ai' : 'human', content).run();
      replies.push({ id: result.meta.last_row_id, playerId: player.id, content });
    }

    if (room.mode === 'solo' && replies.length === 0) {
      const aiResult = await db.prepare(
        `SELECT id, display_name, player_type, ai_persona FROM ai_game_players
         WHERE room_id = ? AND player_type = 'ai'
         ORDER BY RANDOM()
         LIMIT 1`
      ).bind(roomId).all();
      const player = (aiResult.results || [])[0];
      if (player) {
        const content = await generateAiGameReply(context.env, player, room, messages);
        const result = await db.prepare(
          `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
           VALUES (?, ?, ?, 'ai', ?, CURRENT_TIMESTAMP)`
        ).bind(roomId, player.id, player.display_name, content).run();
        replies.push({ id: result.meta.last_row_id, playerId: player.id, content });
      }
    }

    return json({ success: true, data: { replies } });
  } catch (error: any) {
    console.error('ai-game ai-turn error:', error);
    return json({ success: false, message: error.message || 'AI 回复失败' }, 500);
  }
};
