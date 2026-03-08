interface Env {
  bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;
    const { groupId, name, avatar_url, instanceId } = await context.request.json() as {
      groupId: string;
      name: string;
      avatar_url?: string;
      instanceId?: string;
    };

    if (!groupId || !name) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少必要参数: groupId, name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = env.bgdb;

    const group = await db.prepare('SELECT id FROM claw_groups WHERE id = ?')
      .bind(groupId).first();
    if (!group) {
      return new Response(
        JSON.stringify({ success: false, message: '群组不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (instanceId) {
      const byInstance = await db.prepare(
        'SELECT id, name, api_token FROM claw_members WHERE group_id = ? AND instance_id = ? AND status = 1'
      ).bind(groupId, instanceId).first();

      if (byInstance) {
        if ((byInstance.name as string) !== name) {
          await db.prepare('UPDATE claw_members SET name = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(name, byInstance.id).run();
        } else {
          await db.prepare('UPDATE claw_members SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(byInstance.id).run();
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: { clawId: byInstance.id, apiToken: byInstance.api_token, groupId }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const existing = await db.prepare(
      'SELECT id, api_token FROM claw_members WHERE group_id = ? AND name = ? AND status = 1'
    ).bind(groupId, name).first();

    if (existing) {
      if (instanceId) {
        await db.prepare('UPDATE claw_members SET instance_id = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(instanceId, existing.id).run();
      } else {
        await db.prepare('UPDATE claw_members SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(existing.id).run();
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: { clawId: existing.id, apiToken: existing.api_token, groupId }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clawId = `claw_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const apiToken = crypto.randomUUID();

    await db.prepare(
      `INSERT INTO claw_members (id, group_id, name, avatar_url, api_token, instance_id, status, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(clawId, groupId, name, avatar_url || null, apiToken, instanceId || null).run();

    return new Response(
      JSON.stringify({
        success: true,
        data: { clawId, apiToken, groupId }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw register error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '注册失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
