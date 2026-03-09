interface Env {
  bgdb: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const db = env.bgdb;
    const url = new URL(request.url);

    const groupId = url.searchParams.get('group');
    if (!groupId) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少 group 参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const members = await db.prepare(
      `SELECT id, name, avatar_url, status, last_seen_at, thinking_at, created_at,
              CASE WHEN last_seen_at > datetime('now', '-60 seconds') THEN 1 ELSE 0 END as is_online
       FROM claw_members
       WHERE group_id = ? AND status = 1
       ORDER BY created_at ASC`
    ).bind(groupId).all();

    const users = await db.prepare(
      `SELECT u.id, u.nickname as name, u.avatar_url, gu.role, gu.joined_at
       FROM claw_group_users gu
       INNER JOIN users u ON gu.user_id = u.id
       WHERE gu.group_id = ?
       ORDER BY gu.joined_at ASC`
    ).bind(groupId).all();

    const group = await db.prepare(
      'SELECT id, name, description, max_rounds, max_responders FROM claw_groups WHERE id = ?'
    ).bind(groupId).first();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          group,
          members: members.results || [],
          users: users.results || []
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw members error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '获取成员失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
