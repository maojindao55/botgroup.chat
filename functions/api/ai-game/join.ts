import { getPlayers, getRoom, json } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const { roomId, displayName } = await context.request.json() as {
      roomId: string;
      displayName?: string;
    };
    if (!roomId) return json({ success: false, message: '缺少房间 ID' }, 400);

    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);
    if (room.status !== 'waiting') return json({ success: false, message: '游戏已开始，当前只能围观' }, 400);

    const userId = (context as any).data?.user?.userId || null;
    const joinType = room.mode === 'solo' ? 'observer' : 'human';
    const existing = userId
      ? await db.prepare(`SELECT id FROM ai_game_players WHERE room_id = ? AND user_id = ? AND player_type = ?`)
          .bind(roomId, userId, joinType).first()
      : null;
    if (existing) return json({ success: true, data: { playerId: existing.id } });

    const players = await getPlayers(db, roomId, true);

    if (room.mode === 'solo') {
      const playerId = `observer-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
      const name = (displayName || (context as any).data?.user?.nickname || '鉴定官').trim().slice(0, 16);
      await db.prepare(
        `INSERT INTO ai_game_players
         (id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, created_at)
         VALUES (?, ?, ?, ?, 'observer', 'observer', NULL, -1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(playerId, roomId, userId, name || '鉴定官').run();
      return json({ success: true, data: { playerId } });
    }

    const existingHuman = userId
      ? await db.prepare(`SELECT id FROM ai_game_players WHERE room_id = ? AND user_id = ? AND player_type = 'human'`)
          .bind(roomId, userId).first()
      : null;
    if (existingHuman) return json({ success: true, data: { playerId: existingHuman.id } });

    const humanCount = players.filter((p: any) => p.player_type === 'human').length;
    const availableHumanSeats = Math.max(1, Number(room.max_players) - Number(room.ai_count));
    if (humanCount >= availableHumanSeats) return json({ success: false, message: '真人席位已满' }, 400);

    const playerId = `player-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const name = (displayName || (context as any).data?.user?.nickname || `玩家${humanCount + 1}`).trim().slice(0, 16);
    const seatIndex = players.length;
    await db.prepare(
      `INSERT INTO ai_game_players
       (id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, 'human', 'human', NULL, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(playerId, roomId, userId, name || `玩家${humanCount + 1}`, seatIndex).run();

    return json({ success: true, data: { playerId } });
  } catch (error: any) {
    console.error('ai-game join error:', error);
    return json({ success: false, message: error.message || '加入房间失败' }, 500);
  }
};
