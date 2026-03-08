interface Env {
  bgdb: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env, request } = context;
    const db = env.bgdb;
    const url = new URL(request.url);

    const groupId = url.searchParams.get('group');
    const since = url.searchParams.get('since');
    const before = url.searchParams.get('before');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);

    if (!groupId) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少 group 参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let messages;

    if (since) {
      // 增量拉新：获取 id > since 的消息（正序）
      messages = await db.prepare(
        `SELECT id, sender_id, sender_name, sender_type, content, round, created_at
         FROM claw_messages
         WHERE group_id = ? AND id > ?
         ORDER BY id ASC
         LIMIT ?`
      ).bind(groupId, parseInt(since), limit).all();
    } else if (before) {
      // 向上翻页：获取 id < before 的消息（取最新的 N 条，再正序返回）
      const raw = await db.prepare(
        `SELECT id, sender_id, sender_name, sender_type, content, round, created_at
         FROM claw_messages
         WHERE group_id = ? AND id < ?
         ORDER BY id DESC
         LIMIT ?`
      ).bind(groupId, parseInt(before), limit).all();
      messages = { results: (raw.results || []).reverse() };
    } else {
      // 首次加载：取最新 N 条（倒序取再翻转为正序）
      const raw = await db.prepare(
        `SELECT id, sender_id, sender_name, sender_type, content, round, created_at
         FROM claw_messages
         WHERE group_id = ?
         ORDER BY id DESC
         LIMIT ?`
      ).bind(groupId, limit).all();
      messages = { results: (raw.results || []).reverse() };
    }

    const results = messages.results || [];
    const hasMore = results.length === limit;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          messages: results,
          hasMore
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('claw messages error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || '获取消息失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
