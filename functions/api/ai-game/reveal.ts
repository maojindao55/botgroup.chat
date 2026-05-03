import { generateAiGameSummary, getPlayers, getRoom, json, parseUndercoverMeta } from '../../utils/aiGame';

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

    const players = await getPlayers(db, roomId, true);
    const votesResult = await db.prepare(
      `SELECT v.*, voter.display_name as voter_name, target.display_name as target_name, target.secret_role as target_role, target.ai_persona as target_persona
       FROM ai_game_votes v
       LEFT JOIN ai_game_players voter ON voter.id = v.voter_player_id
       LEFT JOIN ai_game_players target ON target.id = v.target_player_id
       WHERE v.room_id = ?`
    ).bind(roomId).all();
    const votes = votesResult.results || [];
    if (room.mode === 'undercover') {
      const player = players.find((p: any) => p.player_type === 'human');
      const playerMeta = parseUndercoverMeta(player?.ai_persona);
      const playerVote = votes.find((v: any) => v.voter_player_id === player?.id);
      const undercover = players.find((p: any) => parseUndercoverMeta(p.ai_persona)?.role === 'undercover');
      const pair = parseUndercoverMeta(undercover?.ai_persona);
      const tally = new Map<string, number>();
      votes.forEach((vote: any) => tally.set(vote.target_player_id, (tally.get(vote.target_player_id) || 0) + 1));
      const sortedTally = Array.from(tally.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        if (a[0] === playerVote?.target_player_id) return -1;
        if (b[0] === playerVote?.target_player_id) return 1;
        return a[0].localeCompare(b[0]);
      });
      const majorityTargetId = sortedTally[0]?.[0] || playerVote?.target_player_id;
      const majorityTarget = players.find((p: any) => p.id === majorityTargetId);
      const majorityMeta = parseUndercoverMeta(majorityTarget?.ai_persona);
      const playerTarget = players.find((p: any) => p.id === playerVote?.target_player_id);
      const playerTargetMeta = parseUndercoverMeta(playerTarget?.ai_persona);
      const playerGuessCorrect = playerVote ? (playerMeta?.role === 'undercover'
        ? playerTarget?.id !== player?.id && playerTargetMeta?.role === 'civilian'
        : playerTargetMeta?.role === 'undercover') : false;
      const groupSucceeded = playerMeta?.role === 'undercover'
        ? majorityTarget?.id !== player?.id && majorityMeta?.role === 'civilian'
        : majorityMeta?.role === 'undercover';
      const voteText = votes.map((vote: any) => `${vote.voter_name}投${vote.target_name}`).join('，');
      const summary = playerVote
        ? playerMeta?.role === 'undercover'
          ? `你是卧底，词语是「${playerMeta.word}」。你投给了 ${playerTarget?.display_name || '未知'}（${playerTargetMeta?.role === 'undercover' ? '卧底' : '平民'}），${playerGuessCorrect ? '这次甩锅方向是对的' : '这票没有成功甩到平民身上'}。群体投票结果是 ${majorityTarget?.display_name || '未知'} 出局（${majorityMeta?.role === 'undercover' ? '卧底' : '平民'}），${groupSucceeded ? '群体被你带偏，卧底获胜' : '群体没有被带偏，卧底失败'}。平民词是「${pair?.civilianWord || ''}」，卧底词是「${pair?.undercoverWord || ''}」。投票明细：${voteText}。`
          : `你是平民，词语是「${playerMeta?.word || ''}」。你投给了 ${playerTarget?.display_name || '未知'}（${playerTargetMeta?.role === 'undercover' ? '卧底' : '平民'}），${playerGuessCorrect ? '你的个人判断正确' : '你的个人判断错误'}。群体投票结果是 ${majorityTarget?.display_name || '未知'} 出局（${majorityMeta?.role === 'undercover' ? '卧底' : '平民'}），${groupSucceeded ? '群体成功找出卧底' : `群体被带偏，真正的卧底是 ${undercover?.display_name || '未知'}`}。平民词是「${pair?.civilianWord || ''}」，卧底词是「${pair?.undercoverWord || ''}」。投票明细：${voteText}。`
        : `你还没有投票，本局直接揭晓。真正的卧底是${undercover?.display_name || '未知'}。平民词是「${pair?.civilianWord || ''}」，卧底词是「${pair?.undercoverWord || ''}」。`;
      const shareText = playerGuessCorrect
        ? `我在谁是卧底里个人判断猜中了${playerMeta?.role === 'undercover' ? '甩锅对象' : '卧底'}，平民词「${pair?.civilianWord || ''}」，卧底词「${pair?.undercoverWord || ''}」。`
        : `我在谁是卧底里翻车了，真正卧底是${undercover?.display_name || '未知'}。`;

      await db.prepare(
        `INSERT INTO ai_game_results (room_id, human_accuracy, ai_escape_rate, best_disguised_player_id, summary, share_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(room_id) DO UPDATE SET
           human_accuracy = excluded.human_accuracy,
           ai_escape_rate = excluded.ai_escape_rate,
           best_disguised_player_id = excluded.best_disguised_player_id,
           summary = excluded.summary,
           share_text = excluded.share_text`
      ).bind(roomId, playerGuessCorrect ? 1 : 0, groupSucceeded ? 0 : 1, undercover?.id || null, summary, shareText).run();
      await db.prepare(`UPDATE ai_game_rooms SET status = 'revealed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = ?`)
        .bind(roomId).run();

      return json({ success: true });
    }

    const humanVotes = room.mode === 'jury' ? [] : votes.filter((v: any) => {
      const voter = players.find((p: any) => p.id === v.voter_player_id);
      return voter?.secret_role === 'human' || voter?.secret_role === 'observer';
    });
    const undercoverPlayers = room.mode === 'undercover'
      ? players.filter((p: any) => parseUndercoverMeta(p.ai_persona)?.role === 'undercover')
      : [];
    const correctVotes = room.mode === 'undercover'
      ? humanVotes.filter((v: any) => parseUndercoverMeta(v.target_persona)?.role === 'undercover').length
      : humanVotes.filter((v: any) => v.target_role === 'ai').length;
    const aiPlayers = room.mode === 'undercover' ? undercoverPlayers : players.filter((p: any) => p.secret_role === 'ai');
    const detectedAi = new Set(room.mode === 'undercover'
      ? humanVotes.filter((v: any) => parseUndercoverMeta(v.target_persona)?.role === 'undercover').map((v: any) => v.target_player_id)
      : humanVotes.filter((v: any) => v.target_role === 'ai').map((v: any) => v.target_player_id));
    const humanAccuracy = room.mode === 'jury' ? 0 : humanVotes.length ? correctVotes / humanVotes.length : 0;
    const aiEscapeRate = room.mode === 'jury' ? 0 : aiPlayers.length ? (aiPlayers.length - detectedAi.size) / aiPlayers.length : 0;

    const messagesResult = await db.prepare(
      `SELECT sender_name, content, sender_type, created_at FROM ai_game_messages WHERE room_id = ? ORDER BY id ASC`
    ).bind(roomId).all();
    const summary = await generateAiGameSummary(context.env, room, players, messagesResult.results || [], votes);
    const bestDisguised = aiPlayers.find((p: any) => !detectedAi.has(p.id)) || aiPlayers[0] || null;

    await db.prepare(
      `INSERT INTO ai_game_results (room_id, human_accuracy, ai_escape_rate, best_disguised_player_id, summary, share_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(room_id) DO UPDATE SET
         human_accuracy = excluded.human_accuracy,
         ai_escape_rate = excluded.ai_escape_rate,
         best_disguised_player_id = excluded.best_disguised_player_id,
         summary = excluded.summary,
         share_text = excluded.share_text`
    ).bind(roomId, humanAccuracy, aiEscapeRate, bestDisguised?.id || null, summary.summary, summary.shareText).run();
    await db.prepare(`UPDATE ai_game_rooms SET status = 'revealed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = ?`)
      .bind(roomId).run();

    return json({ success: true });
  } catch (error: any) {
    console.error('ai-game reveal error:', error);
    return json({ success: false, message: error.message || '揭晓失败' }, 500);
  }
};
