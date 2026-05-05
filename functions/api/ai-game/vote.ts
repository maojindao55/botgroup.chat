import { generateUndercoverVote, getPlayers, getRoom, json, parseUndercoverMeta } from '../../utils/aiGame';
import { isCampaignRoom } from '../../utils/aiGameCampaign';
import { canSubmitUndercoverVoteThisRound } from '../../utils/aiGameVoteFlow';

interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.bgdb;
    const { roomId, voterPlayerId, targetPlayerId, reason } = await context.request.json() as {
      roomId: string;
      voterPlayerId: string;
      targetPlayerId: string;
      reason?: string;
    };
    if (!roomId || !voterPlayerId || !targetPlayerId) return json({ success: false, message: '缺少必要参数' }, 400);
    const room = await getRoom(db, roomId);
    if (!room) return json({ success: false, message: '房间不存在' }, 404);
    if (room.status !== 'voting' && room.status !== 'playing') return json({ success: false, message: '当前不能投票' }, 400);
    if (isCampaignRoom(room)) {
      const expired = await db.prepare(
        `SELECT 1 as expired
         WHERE datetime(?, '+' || ? || ' seconds') <= CURRENT_TIMESTAMP`
      ).bind(room.started_at, room.duration_seconds).first();
      if (expired) return json({ success: false, message: '本关已超时，挑战失败' }, 400);
    }

    const voter = await db.prepare(`SELECT id, display_name, player_type, eliminated_at FROM ai_game_players WHERE room_id = ? AND id = ?`)
      .bind(roomId, voterPlayerId).first();
    const target = await db.prepare(`SELECT id, player_type, eliminated_at FROM ai_game_players WHERE room_id = ? AND id = ?`)
      .bind(roomId, targetPlayerId).first();
    if (!voter || !target) return json({ success: false, message: '玩家不存在' }, 404);
    if (voter.player_type !== 'human') return json({ success: false, message: '围观者不能投票' }, 403);
    if (voterPlayerId === targetPlayerId) return json({ success: false, message: '不能投自己' }, 400);
    if (voter.eliminated_at) return json({ success: false, message: '你已出局，不能投票' }, 403);
    if (target.player_type === 'observer') return json({ success: false, message: '不能投观察者' }, 400);
    if (target.eliminated_at) return json({ success: false, message: '不能投已出局玩家' }, 400);

    if (room.mode === 'undercover') {
      const activeAiCountRow = await db.prepare(
        `SELECT COUNT(*) as count FROM ai_game_players
         WHERE room_id = ? AND player_type = 'ai' AND eliminated_at IS NULL`
      ).bind(roomId).first();
      const latestVoteResult = await db.prepare(
        `SELECT id FROM ai_game_messages
         WHERE room_id = ? AND sender_type = 'system' AND content LIKE '投票完成%'
         ORDER BY id DESC LIMIT 1`
      ).bind(roomId).first();
      const latestVoterMessage = await db.prepare(
        `SELECT id FROM ai_game_messages
         WHERE room_id = ? AND player_id = ? AND sender_type = 'human'
         ORDER BY id DESC LIMIT 1`
      ).bind(roomId, voterPlayerId).first();
      const aiMessagesAfterHuman = latestVoterMessage?.id
        ? await db.prepare(
          `SELECT COUNT(*) as count FROM ai_game_messages
           WHERE room_id = ? AND sender_type = 'ai' AND id > ?`
        ).bind(roomId, latestVoterMessage.id).first()
        : null;

      const voteFlow = canSubmitUndercoverVoteThisRound({
        latestVoteResultId: Number(latestVoteResult?.id || 0),
        latestHumanMessageId: Number(latestVoterMessage?.id || 0),
        aiMessagesAfterHuman: Number(aiMessagesAfterHuman?.count || 0),
        activeAiCount: Number(activeAiCountRow?.count || 0),
      });

      if (!voteFlow.allowed) {
        return json({
          success: false,
          message: voteFlow.reason === 'needs-human-message'
            ? '请先描述你的词或追问一次，再进行投票'
            : '请等 AI 完成本轮描述后再投票',
        }, 400);
      }

      await db.prepare(`DELETE FROM ai_game_votes WHERE room_id = ?`).bind(roomId).run();
    }

    await db.prepare(
      `INSERT INTO ai_game_votes (room_id, voter_player_id, target_player_id, reason, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(room_id, voter_player_id) DO UPDATE SET target_player_id = excluded.target_player_id, reason = excluded.reason`
    ).bind(roomId, voterPlayerId, targetPlayerId, reason?.trim().slice(0, 120) || '').run();

    if (room.mode === 'undercover') {
      const players = await getPlayers(db, roomId, true);
      const activePlayers = players.filter((player: any) => player.player_type !== 'observer' && !player.eliminated_at);
      const messagesResult = await db.prepare(
        `SELECT sender_name, sender_type, content, created_at
         FROM ai_game_messages
         WHERE room_id = ?
         ORDER BY id ASC`
      ).bind(roomId).all();
      const messages = messagesResult.results || [];
      const aiPlayers = activePlayers.filter((player: any) => player.player_type === 'ai');
      const voteLines = [];

      const humanTarget = players.find((player: any) => player.id === targetPlayerId);
      if (humanTarget) {
        voteLines.push(`${voter.display_name || '玩家'} -> ${humanTarget.display_name}`);
      }

      for (const aiPlayer of aiPlayers) {
        const aiTarget = await generateUndercoverVote(context.env, aiPlayer, activePlayers, messages);
        if (!aiTarget) continue;
        await db.prepare(
          `INSERT INTO ai_game_votes (room_id, voter_player_id, target_player_id, reason, created_at)
           VALUES (?, ?, ?, 'ai-auto', CURRENT_TIMESTAMP)
           ON CONFLICT(room_id, voter_player_id) DO UPDATE SET target_player_id = excluded.target_player_id, reason = excluded.reason`
        ).bind(roomId, aiPlayer.id, aiTarget.id).run();
        voteLines.push(`${aiPlayer.display_name} -> ${aiTarget.display_name}`);
      }

      if (voteLines.length > 0) {
        const currentVotes = await db.prepare(
          `SELECT v.*, voter.display_name as voter_name, target.display_name as target_name, target.ai_persona as target_persona
           FROM ai_game_votes v
           LEFT JOIN ai_game_players voter ON voter.id = v.voter_player_id
           LEFT JOIN ai_game_players target ON target.id = v.target_player_id
           WHERE v.room_id = ?`
        ).bind(roomId).all();
        const votes = currentVotes.results || [];
        const playerVote = votes.find((vote: any) => vote.voter_player_id === voterPlayerId);
        const tally = new Map<string, number>();
        votes.forEach((vote: any) => tally.set(vote.target_player_id, (tally.get(vote.target_player_id) || 0) + 1));
        const majorityTargetId = Array.from(tally.entries()).sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          if (a[0] === playerVote?.target_player_id) return -1;
          if (b[0] === playerVote?.target_player_id) return 1;
          return a[0].localeCompare(b[0]);
        })[0]?.[0];
        const eliminated = activePlayers.find((player: any) => player.id === majorityTargetId);
        const eliminatedMeta = parseUndercoverMeta(eliminated?.ai_persona);
        const humanPlayer = activePlayers.find((player: any) => player.player_type === 'human');
        const humanMeta = parseUndercoverMeta(humanPlayer?.ai_persona);
        const remainingAfterElimination = activePlayers.filter((player: any) => player.id !== eliminated?.id);
        const undercoverStillActive = remainingAfterElimination.some((player: any) => parseUndercoverMeta(player.ai_persona)?.role === 'undercover');
        const gameOver = !eliminated || eliminatedMeta?.role === 'undercover' || eliminated?.id === humanPlayer?.id || remainingAfterElimination.length <= 3 || !undercoverStillActive;

        if (eliminated) {
          await db.prepare(`UPDATE ai_game_players SET eliminated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(eliminated.id).run();
        }

        const roundMessage = gameOver
          ? `投票完成：${voteLines.join('，')}。多数票投出 ${eliminated?.display_name || '未知'}，游戏结束，身份已揭晓。`
          : `投票完成：${voteLines.join('，')}。多数票投出 ${eliminated?.display_name || '未知'}，身份暂不公布，继续下一轮描述。`;
        await db.prepare(
          `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
           VALUES (?, 'system', '系统', 'system', ?, CURRENT_TIMESTAMP)`
        ).bind(roomId, roundMessage).run();

        if (gameOver) {
          const undercover = players.find((player: any) => parseUndercoverMeta(player.ai_persona)?.role === 'undercover');
          const pair = parseUndercoverMeta(undercover?.ai_persona);
          const humanTargetMeta = parseUndercoverMeta(humanTarget?.ai_persona);
          const playerGuessCorrect = humanMeta?.role === 'undercover'
            ? humanTarget?.id !== humanPlayer?.id && humanTargetMeta?.role === 'civilian'
            : humanTargetMeta?.role === 'undercover';
          const groupSucceeded = humanMeta?.role === 'undercover'
            ? eliminated?.id !== humanPlayer?.id && eliminatedMeta?.role === 'civilian'
            : eliminatedMeta?.role === 'undercover';
          const wordRevealText = `平民词是「${pair?.civilianWord || ''}」，卧底词是「${pair?.undercoverWord || ''}」。`;
          const summary = humanMeta?.role === 'undercover'
            ? `你是卧底，词语是「${humanMeta.word}」。你投给了 ${humanTarget?.display_name || '未知'}（${humanTargetMeta?.role === 'undercover' ? '卧底' : '平民'}），${playerGuessCorrect ? '这次甩锅方向是对的' : '这票没有成功甩到平民身上'}。多数票投出 ${eliminated?.display_name || '未知'}（${eliminatedMeta?.role === 'undercover' ? '卧底' : '平民'}），${groupSucceeded ? '群体被你带偏，卧底获胜' : '群体没有被带偏，卧底失败'}。${wordRevealText}`
            : `你是平民，词语是「${humanMeta?.word || ''}」。你投给了 ${humanTarget?.display_name || '未知'}（${humanTargetMeta?.role === 'undercover' ? '卧底' : '平民'}），${playerGuessCorrect ? '你的个人判断正确' : '你的个人判断错误'}。多数票投出 ${eliminated?.display_name || '未知'}（${eliminatedMeta?.role === 'undercover' ? '卧底' : '平民'}），${groupSucceeded ? '群体成功找出卧底' : `群体被带偏，真正的卧底是 ${undercover?.display_name || '未知'}`}。${wordRevealText}`;
          const shareText = playerGuessCorrect
            ? `我在谁是卧底里个人判断猜中了${humanMeta?.role === 'undercover' ? '甩锅对象' : '卧底'}，平民词「${pair?.civilianWord || ''}」，卧底词「${pair?.undercoverWord || ''}」。`
            : `我在谁是卧底里个人判断猜错了，真正卧底是${undercover?.display_name || '未知'}。`;
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
          await db.prepare(`UPDATE ai_game_rooms SET status = 'revealed', ended_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(roomId).run();
        }
      }
    }

    return json({ success: true });
  } catch (error: any) {
    console.error('ai-game vote error:', error);
    return json({ success: false, message: error.message || '投票失败' }, 500);
  }
};
