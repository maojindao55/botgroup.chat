import { defaultsForMode, ensurePlayerHeartbeat, getPlayers, getRoom, json, normalizeGameMode, parseUndercoverMeta, publicRoomFields } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const url = new URL(context.request.url);
    const roomId = url.searchParams.get('id');
    const playerId = url.searchParams.get('player');
    if (!roomId) return json({ success: false, message: '缺少房间 ID' }, 400);

    await ensurePlayerHeartbeat(db, playerId || undefined);
    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);

    const reveal = room.status === 'revealed' || room.status === 'archived';
    const players = await getPlayers(db, roomId, reveal);
    const result = reveal
      ? await db.prepare('SELECT * FROM ai_game_results WHERE room_id = ?').bind(roomId).first()
      : null;
    let currentPlayerSecret = null;
    if (room.mode === 'undercover' && playerId) {
      const current = await db.prepare('SELECT ai_persona FROM ai_game_players WHERE id = ? AND room_id = ?')
        .bind(playerId, roomId).first();
      const meta = parseUndercoverMeta(String(current?.ai_persona || ''));
      if (meta) currentPlayerSecret = { word: meta.word, role: reveal ? meta.role : undefined };
    }

    return json({ success: true, data: { room, players, result, currentPlayerSecret } });
  } catch (error: any) {
    console.error('ai-game room get error:', error);
    return json({ success: false, message: error.message || '获取房间失败' }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const body = await context.request.json() as {
      mode?: string;
      title?: string;
      maxPlayers?: number;
      aiCount?: number;
      durationSeconds?: number;
      displayName?: string;
      wordTier?: string;
    };
    const mode = normalizeGameMode(body.mode);
    const defaults = defaultsForMode(mode);
    const maxPlayers = Math.max(3, Math.min(Number(body.maxPlayers || defaults.maxPlayers), 8));
    const aiCount = Math.max(1, Math.min(Number(body.aiCount || defaults.aiCount), maxPlayers - 1));
    const durationSeconds = Math.max(60, Math.min(Number(body.durationSeconds || defaults.durationSeconds), 600));
    const roomId = `game-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const userId = (context as any).data?.user?.userId || null;
    const rawTitle = body.title?.trim() || (mode === 'undercover' ? '谁是卧底' : mode === 'jury' ? 'AI 陪审团' : mode === 'solo' ? '单人鉴定官' : mode === 'reverse' ? '反向图灵局' : mode === 'topic' ? '主题卧底局' : '谁是 AI 经典局');
    const title = mode === 'undercover' && rawTitle.startsWith('卧底晋级赛') && body.wordTier
      ? `${rawTitle} [tier:${String(body.wordTier).replace(/[^\w-]/g, '').slice(0, 20)}]`
      : rawTitle;

    await db.prepare(
      `INSERT INTO ai_game_rooms (${publicRoomFields})
       VALUES (?, ?, 'waiting', ?, ?, ?, ?, 50, ?, NULL, NULL, CURRENT_TIMESTAMP)`
    ).bind(roomId, mode, title, maxPlayers, aiCount, durationSeconds, userId).run();

    return json({ success: true, data: { roomId } });
  } catch (error: any) {
    console.error('ai-game room create error:', error);
    return json({ success: false, message: error.message || '创建房间失败' }, 500);
  }
};
