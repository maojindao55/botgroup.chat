interface Env {
  bgdb: D1Database;
}

async function authenticateClaw(request: Request, db: D1Database) {
  const token = request.headers.get('x-claw-token');
  if (!token) return null;

  const member = await db.prepare(
    'SELECT id, group_id, name, avatar_url FROM claw_members WHERE api_token = ? AND status = 1'
  ).bind(token).first();

  if (member) {
    await db.prepare('UPDATE claw_members SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(member.id).run();
  }

  return member;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const db = env.bgdb;

    const claw = await authenticateClaw(request, db);
    if (!claw) {
      return new Response(
        JSON.stringify({ success: false, message: '鉴权失败' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const since = url.searchParams.get('since') || '0';
    const groupId = claw.group_id as string;
    const clawId = claw.id as string;

    const messages = await db.prepare(
      `SELECT id, sender_id, sender_name, sender_type, content, round, created_at
       FROM claw_messages
       WHERE group_id = ? AND id > ? AND sender_id != ?
       ORDER BY created_at ASC
       LIMIT 50`
    ).bind(groupId, parseInt(since), clawId).all();

    let shouldReply = false;
    let currentRound = 0;
    let replyDelay = 0;
    let mentionedDirectly = false;
    const clawName = claw.name as string;

    if (messages.results && messages.results.length > 0) {
      const latestMsg = await db.prepare(
        `SELECT id, sender_id, sender_name, sender_type, content, round FROM claw_messages
         WHERE group_id = ?
         ORDER BY id DESC LIMIT 1`
      ).bind(groupId).first();

      const groupConfig = await db.prepare(
        'SELECT max_rounds FROM claw_groups WHERE id = ?'
      ).bind(groupId).first();
      const maxRounds = (groupConfig?.max_rounds as number) || 3;

      // 找到本群最近一条用户消息的 id，作为"本轮对话"的起点
      const lastUserMsg = await db.prepare(
        `SELECT id FROM claw_messages
         WHERE group_id = ? AND sender_type = 'user'
         ORDER BY id DESC LIMIT 1`
      ).bind(groupId).first();
      const lastUserMsgId = (lastUserMsg?.id as number) || 0;

      // 本龙虾自上次用户消息以来已回复的次数
      const myReplies = await db.prepare(
        `SELECT COUNT(*) as cnt FROM claw_messages
         WHERE group_id = ? AND sender_id = ? AND sender_type = 'claw' AND id > ?`
      ).bind(groupId, clawId, lastUserMsgId).first();
      const myReplyCount = (myReplies?.cnt as number) || 0;
      currentRound = myReplyCount;

      const latestContent = (latestMsg?.content as string) || '';
      const mentionPattern = /@([\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\-_.]+)/g;
      const mentions: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = mentionPattern.exec(latestContent)) !== null) {
        mentions.push(match[1]);
      }
      const hasMentions = mentions.length > 0;
      mentionedDirectly = mentions.some(m => m === clawName || latestContent.includes(`@${clawName}`));

      if (latestMsg && (latestMsg.sender_id as string) !== clawId) {
        if (hasMentions) {
          // @提及：无视轮次限制，仅被提及的龙虾回复
          shouldReply = mentionedDirectly;
        } else if ((latestMsg.sender_type as string) === 'user') {
          // 用户消息：所有龙虾都回复
          shouldReply = true;
        } else if (myReplyCount < maxRounds) {
          // 龙虾间对话：未超出本龙虾的回复次数上限
          shouldReply = true;
        }
      }

      if (shouldReply) {
        const thinkingClaws = await db.prepare(
          `SELECT COUNT(*) as cnt FROM claw_members
           WHERE group_id = ? AND thinking_at IS NOT NULL AND id != ?`
        ).bind(groupId, clawId).first();
        replyDelay = ((thinkingClaws?.cnt as number) || 0) * 5000;
      }
    }

    if (shouldReply) {
      await db.prepare('UPDATE claw_members SET thinking_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(clawId).run();
    } else {
      await db.prepare('UPDATE claw_members SET thinking_at = NULL WHERE id = ?')
        .bind(clawId).run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          messages: messages.results || [],
          shouldReply,
          currentRound,
          replyDelay,
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw poll error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '拉取消息失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
