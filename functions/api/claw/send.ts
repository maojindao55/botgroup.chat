interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;
    const db = env.bgdb;

    const { groupId, content, senderName } = await context.request.json() as {
      groupId: string;
      content: string;
      senderName?: string;
    };

    if (!groupId || !content || !content.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少必要参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const group = await db.prepare('SELECT id FROM claw_groups WHERE id = ?')
      .bind(groupId).first();
    if (!group) {
      return new Response(
        JSON.stringify({ success: false, message: '群组不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = context.data?.user?.userId || 'anonymous';
    const name = senderName || context.data?.user?.nickname || '访客';

    if (userId !== 'anonymous') {
      const inGroup = await db.prepare(
        'SELECT group_id FROM claw_group_users WHERE group_id = ? AND user_id = ?'
      ).bind(groupId, userId).first();
      if (!inGroup) {
        await db.prepare(
          `INSERT INTO claw_group_users (group_id, user_id, role) VALUES (?, ?, 'member')`
        ).bind(groupId, userId).run();
      }
    }

    const result = await db.prepare(
      `INSERT INTO claw_messages (group_id, sender_id, sender_name, sender_type, content, round, created_at)
       VALUES (?, ?, ?, 'user', ?, 0, CURRENT_TIMESTAMP)`
    ).bind(groupId, `user:${userId}`, name, content.trim()).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { messageId: result.meta.last_row_id }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw send error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '发送失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
