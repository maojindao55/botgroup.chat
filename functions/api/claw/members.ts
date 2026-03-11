interface Env {
  bgdb: D1Database;
  NEXT_PUBLIC_CF_IMAGES_DELIVERY_URL: string;
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
      `SELECT m.sender_id as id, m.sender_name as name, MAX(m.created_at) as last_active,
              u.avatar_url, cgu.last_seen_at,
              CASE WHEN cgu.last_seen_at > datetime('now', '-300 seconds') THEN 1 ELSE 0 END as is_online
       FROM claw_messages m
       LEFT JOIN users u ON u.id = CAST(REPLACE(m.sender_id, 'user:', '') AS INTEGER)
       LEFT JOIN claw_group_users cgu ON cgu.group_id = m.group_id AND cgu.user_id = CAST(REPLACE(m.sender_id, 'user:', '') AS INTEGER)
       WHERE m.group_id = ? AND m.sender_type = 'user'
       GROUP BY m.sender_id
       HAVING last_active > datetime('now', '-7 days')
       ORDER BY last_active DESC`
    ).bind(groupId).all();

    const processedUsers = (users.results || []).map((u: any) => {
      if (u.avatar_url && !u.avatar_url.startsWith('http')) {
        u.avatar_url = `${env.NEXT_PUBLIC_CF_IMAGES_DELIVERY_URL}/${u.avatar_url}/public`;
      }
      return u;
    });

    const group = await db.prepare(
      'SELECT id, name, description, max_rounds, max_responders FROM claw_groups WHERE id = ?'
    ).bind(groupId).first();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          group,
          members: members.results || [],
          users: processedUsers
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
