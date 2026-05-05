import { encodeUndercoverMeta, getDynamicUndercoverPair, getJuryRoles, getPlayers, getRoom, json, pickAiName, pickJuryCase, pickPersona, pickUndercoverPair } from '../../utils/aiGame';
import { canControlAiGameRoom } from '../../utils/aiGamePermission';

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
    if (room.status !== 'waiting') return json({ success: false, message: '游戏已开始' }, 400);
    if (!playerId) return json({ success: false, message: '请先加入房间' }, 403);
    const requester = await db.prepare(
      `SELECT id, player_type FROM ai_game_players WHERE room_id = ? AND id = ?`
    ).bind(roomId, playerId).first();
    if (!canControlAiGameRoom(requester)) return json({ success: false, message: '只有玩家可以开始游戏' }, 403);

    const players = await getPlayers(db, roomId, true);
    const usedNames = new Set(players.map((p: any) => p.display_name));
    const candidatePlayers = players.filter((p: any) => p.player_type !== 'observer');
    const humanPlayerCount = players.filter((p: any) => p.player_type === 'human').length;

    if (room.mode !== 'solo' && room.mode !== 'jury' && room.mode !== 'undercover' && humanPlayerCount < 2) {
      return json({ success: false, message: '多人模式至少需要 2 个真人。单人试玩请选择“单人鉴定官”。' }, 400);
    }

    if (room.mode === 'undercover') {
      const aiToCreate = Math.max(0, Number(room.ai_count) - players.filter((p: any) => p.player_type === 'ai').length);
      for (let i = 0; i < aiToCreate; i++) {
        const idx = candidatePlayers.length + i;
        const name = pickAiName(idx + 1, usedNames);
        usedNames.add(name);
        await db.prepare(
          `INSERT INTO ai_game_players
           (id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, created_at)
           VALUES (?, ?, NULL, ?, 'ai', 'ai', NULL, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(`undercover-ai-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, roomId, name, idx + 1).run();
      }

      const allCandidates = (await getPlayers(db, roomId, true)).filter((p: any) => p.player_type !== 'observer');
      const tier = String(room.title || '').match(/\[tier:([\w-]+)\]/)?.[1] || '';
      const [civilianWord, undercoverWord] = String(room.title || '').startsWith('卧底晋级赛')
        ? await getDynamicUndercoverPair(db, context.env, { roomId, tier, seed: `${room.title}:${roomId}` })
        : pickUndercoverPair(roomId);
      const undercoverIndex = [...roomId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % allCandidates.length;
      for (let i = 0; i < allCandidates.length; i++) {
        const player = allCandidates[i];
        const role = i === undercoverIndex ? 'undercover' : 'civilian';
        const word = role === 'undercover' ? undercoverWord : civilianWord;
        await db.prepare(
          `UPDATE ai_game_players SET ai_persona = ? WHERE id = ?`
        ).bind(encodeUndercoverMeta(role, word, civilianWord, undercoverWord), player.id).run();
      }
    } else if (room.mode === 'jury') {
      const roles = getJuryRoles();
      const existingRoleCount = players.filter((p: any) => p.player_type === 'ai').length;
      for (let i = existingRoleCount; i < roles.length; i++) {
        const role = roles[i];
        await db.prepare(
          `INSERT INTO ai_game_players
           (id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, created_at)
           VALUES (?, ?, NULL, ?, 'ai', 'ai', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(`jury-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, roomId, role.name, role.persona, i + 1).run();
      }
    } else if (room.mode === 'solo') {
      const npcToAdd = Math.max(0, Number(room.max_players) - Number(room.ai_count) - candidatePlayers.filter((p: any) => p.player_type === 'human').length);
      for (let i = 0; i < npcToAdd; i++) {
        const idx = candidatePlayers.length + i;
        const name = pickAiName(idx + 3, usedNames);
        usedNames.add(name);
        await db.prepare(
          `INSERT INTO ai_game_players
           (id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, created_at)
           VALUES (?, ?, NULL, ?, 'human', 'human', 'npc-human', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(`npc-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, roomId, name, idx).run();
      }
    }

    const afterNpcPlayers = await getPlayers(db, roomId, true);
    const aiExisting = afterNpcPlayers.filter((p: any) => p.player_type === 'ai').length;
    const aiToAdd = room.mode === 'jury' || room.mode === 'undercover' ? 0 : Number(room.ai_count) - aiExisting;

    for (let i = 0; i < aiToAdd; i++) {
      const idx = afterNpcPlayers.filter((p: any) => p.player_type !== 'observer').length + i;
      const aiName = pickAiName(idx, usedNames);
      usedNames.add(aiName);
      await db.prepare(
        `INSERT INTO ai_game_players
         (id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, created_at)
         VALUES (?, ?, NULL, ?, 'ai', 'ai', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(`ai-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, roomId, aiName, pickPersona(idx), idx).run();
    }

    const allPlayers = await getPlayers(db, roomId, true);
    const candidateCount = allPlayers.filter((p: any) => p.player_type !== 'observer').length;
    await db.prepare(
      `UPDATE ai_game_rooms SET status = 'playing', started_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(roomId).run();
    await db.prepare(
      `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
       VALUES (?, 'system', '系统', 'system', ?, CURRENT_TIMESTAMP)`
    ).bind(roomId, room.mode === 'undercover'
      ? `游戏开始。每个人已拿到自己的词。请依次描述，不能直接说出词语本身。`
      : room.mode === 'jury'
      ? `开庭。本案指控：${pickJuryCase(roomId)} 被告可以陈述事实、狡辩或甩锅。`
      : room.mode === 'solo'
        ? `单人鉴定开始。${candidateCount} 个候选玩家里有 ${room.ai_count} 个 AI，你可以发问题观察他们。`
        : `游戏开始。${candidateCount} 个席位里有 ${room.ai_count} 个 AI，聊天结束后投票猜身份。`
    ).run();

    return json({ success: true, data: { started: true } });
  } catch (error: any) {
    console.error('ai-game start error:', error);
    return json({ success: false, message: error.message || '开始游戏失败' }, 500);
  }
};
