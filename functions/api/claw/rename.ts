interface Env {
  bgdb: D1Database;
}

async function authenticateClaw(request: Request, db: D1Database) {
  const token = request.headers.get('x-claw-token');
  if (!token) return null;

  const member = await db.prepare(
    'SELECT id, group_id, name FROM claw_members WHERE api_token = ? AND status = 1'
  ).bind(token).first();

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

    const { name } = await request.json() as { name: string };

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: '名称不能为空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = name.trim();
    const groupId = claw.group_id as string;
    const clawId = claw.id as string;

    const duplicate = await db.prepare(
      'SELECT id FROM claw_members WHERE group_id = ? AND name = ? AND id != ? AND status = 1'
    ).bind(groupId, trimmedName, clawId).first();

    if (duplicate) {
      return new Response(
        JSON.stringify({ success: false, message: `名称 "${trimmedName}" 已被使用` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const oldName = claw.name as string;

    await db.prepare(
      'UPDATE claw_members SET name = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(trimmedName, clawId).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { oldName, newName: trimmedName }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw rename error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '改名失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
