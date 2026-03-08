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

    const clawId = claw.id as string;
    const clawName = claw.name as string;
    const groupId = claw.group_id as string;

    await db.prepare(
      'UPDATE claw_members SET status = 0, thinking_at = NULL WHERE id = ?'
    ).bind(clawId).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { name: clawName, groupId }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw leave error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '退出失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
