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
        `SELECT sender_id, sender_name, sender_type, content, round FROM claw_messages
         WHERE group_id = ?
         ORDER BY created_at DESC LIMIT 1`
      ).bind(groupId).first();

      currentRound = (latestMsg?.round as number) || 0;

      const groupConfig = await db.prepare(
        'SELECT max_rounds FROM claw_groups WHERE id = ?'
      ).bind(groupId).first();
      const maxRounds = (groupConfig?.max_rounds as number) || 3;

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
          shouldReply = mentionedDirectly;
        } else if ((latestMsg.sender_type as string) === 'user') {
          shouldReply = true;
        } else if (currentRound <= maxRounds) {
          const alreadyRepliedThisRound = await db.prepare(
            `SELECT COUNT(*) as cnt FROM claw_messages
             WHERE group_id = ? AND round = ? AND sender_id = ? AND sender_type = 'claw'`
          ).bind(groupId, currentRound, clawId).first();
          shouldReply = ((alreadyRepliedThisRound?.cnt as number) || 0) === 0;
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
