import { detectHumanHuntHook, generateAiGameReply, generateHumanHuntReply, generateJuryReply, generateNpcReply, generateUndercoverReply, getHumanHuntTurnState, getPlayers, getRoom, json } from '../../utils/aiGame';

interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const { roomId, force } = await context.request.json() as { roomId: string; force?: boolean };
    if (!roomId) return json({ success: false, message: '缺少房间 ID' }, 400);
    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);
    if (room.status !== 'playing') return json({ success: true, data: { replies: [] } });

    if (room.mode === 'human_hunt') {
      const replies = [];
      const players = await getPlayers(db, roomId, true);
      const activePlayers = players.filter((player: any) => player.player_type !== 'observer' && !player.eliminated_at);
      const messagesResult = await db.prepare(
        `SELECT id, room_id, player_id, sender_name, sender_type, content, created_at
         FROM ai_game_messages
         WHERE room_id = ?
         ORDER BY id ASC`
      ).bind(roomId).all();
      let messages = messagesResult.results || [];
      const turnState = getHumanHuntTurnState(players, messages);
      const latest = messages[messages.length - 1];
      const noRoundSpeech = turnState.speechCount === 0;
      const starter = turnState.starter;
      if (noRoundSpeech && starter?.player_type !== 'ai' && !force) {
        return json({ success: true, data: { replies: [] } });
      }
      const hook = detectHumanHuntHook(messages, activePlayers);
      // hook.type 决定本轮回复人数：自曝 3 人围观，挑衅/点名/提问 2 人，其他 1 人
      const hookResponderLimit: Record<string, number> = {
        self_claim: 3,
        provoke: 2,
        mention: 2,
        question: 2,
        normal: 1,
        starter: 1,
      };
      const baseLimit = hookResponderLimit[hook.type] ?? 1;
      const responderLimit = force
        ? Math.max(3, baseLimit)
        : noRoundSpeech
          ? 1
          : Math.min(activePlayers.length, baseLimit);
      const spokenIds = turnState.spokenIds || new Set<string>();
      const mentionedPlayer = hook.mentionedPlayer || null;
      const impliedTarget = hook.impliedTarget || null;
      const targetResponder = [mentionedPlayer, impliedTarget]
        .find((player: any) => player?.player_type === 'ai' && player.id !== latest?.player_id);
      const sortedResponders = activePlayers
        .filter((player: any) => player.player_type === 'ai' && player.id !== latest?.player_id)
        .sort((a: any, b: any) => {
          if (targetResponder?.id === a.id) return -1;
          if (targetResponder?.id === b.id) return 1;
          const aUnspoken = spokenIds.has(String(a.id)) ? 1 : 0;
          const bUnspoken = spokenIds.has(String(b.id)) ? 1 : 0;
          if (aUnspoken !== bUnspoken) return aUnspoken - bUnspoken;
          const seed = `${roomId}:${turnState.round}:${messages.length}:${hook.type}`;
          const aScore = [...`${seed}:${a.id}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
          const bScore = [...`${seed}:${b.id}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
          return aScore - bScore;
        });
      const responders = noRoundSpeech && starter?.player_type === 'ai'
        ? [starter]
        : sortedResponders.slice(0, responderLimit);

      // 每个 responder 在本批里的发言序号，用于让多个 AI 角度有差异
      const intentVariantsByHook: Record<string, string[]> = {
        self_claim: [
          '刚才有人自曝是真人，你阴阳怪气地怼一句，比如"装得真像"或反问"凭啥信你"，但绝对不能说自己是 AI。',
          '跟着自曝玩个梗，比如"那我也是真人"或者"+1"，淡淡带过，不要解释。',
          '一脸不信地冷处理，比如"哦"、"行行行"，或者把话题推开。',
        ],
        provoke: [
          '对方在挑衅扣 AI 帽子，你冷淡反问"你急啥"或"说这话的最可疑"，不要顺着承认。',
          '把话题岔开，让群里别再纠缠这个，但语气别太正式。',
        ],
        mention: [
          '你刚被点名了，简短接一句即可，可以反问也可以装没听清。',
          '帮被点的人接一句，可以是怀疑也可以是带过。',
        ],
        question: [
          '简短答一下问题，或者反问回去。',
          '从另一个角度回答，不要复读上一个人。',
        ],
        starter: [
          '本轮先手，普普通通起个话头，别像念稿一样。',
        ],
        normal: [
          '正常接话一句即可，不要主动抢戏。',
        ],
      };
      const intentVariants = intentVariantsByHook[hook.type] || intentVariantsByHook.normal;

      for (let i = 0; i < responders.length; i++) {
        const speaker = responders[i];
        let intent: string;
        if (noRoundSpeech) {
          intent = '你是本轮先手，用很普通的一句话开场，别提题目，别编生活经历。';
        } else if (force) {
          intent = '主动接一下群聊，让还没说话的人参与感更强；可以转问别人，不要编具体生活经历。';
        } else if (targetResponder?.id === speaker.id) {
          intent = '你刚被点到或被追问了，简短回应一句，不要编具体生活经历。';
        } else {
          intent = intentVariants[i % intentVariants.length];
        }
        const speakerHookType = noRoundSpeech ? 'starter' : hook.type;
        const content = await generateHumanHuntReply(context.env, speaker, room, messages, intent, speakerHookType);
        if (!content.trim()) continue;
        const result = await db.prepare(
          `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
           VALUES (?, ?, ?, 'ai', ?, CURRENT_TIMESTAMP)`
        ).bind(roomId, speaker.id, speaker.display_name, content).run();
        const inserted = {
          id: result.meta.last_row_id,
          room_id: roomId,
          player_id: speaker.id,
          sender_name: speaker.display_name,
          sender_type: 'ai',
          content,
          created_at: new Date().toISOString(),
        };
        replies.push({ id: result.meta.last_row_id, playerId: speaker.id, content });
        messages = [...messages, inserted];
      }

      return json({ success: true, data: { replies } });
    }

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
