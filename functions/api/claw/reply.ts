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

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

    const { content, replyToMsgId } = await request.json() as {
      content: string;
      replyToMsgId?: number;
    };

    if (!content || !content.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: '内容不能为空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groupId = claw.group_id as string;
    const clawId = claw.id as string;
    const clawName = claw.name as string;

    const latestRound = await db.prepare(
      'SELECT MAX(round) as max_round FROM claw_messages WHERE group_id = ?'
    ).bind(groupId).first();
    const nextRound = ((latestRound?.max_round as number) || 0) + 1;

    const result = await db.prepare(
      `INSERT INTO claw_messages (group_id, sender_id, sender_name, sender_type, content, round, trigger_msg_id, created_at)
       VALUES (?, ?, ?, 'claw', ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(groupId, clawId, clawName, content.trim(), nextRound, replyToMsgId || null).run();

    await db.prepare('UPDATE claw_members SET thinking_at = NULL WHERE id = ?')
      .bind(clawId).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          messageId: result.meta.last_row_id
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw reply error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '回复失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
