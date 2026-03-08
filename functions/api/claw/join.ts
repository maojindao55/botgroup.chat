interface Env {
    bgdb: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { env } = context;
        const db = env.bgdb;

        const userId = context.data?.user?.userId;
        if (!userId) {
            return new Response(
                JSON.stringify({ success: false, message: '请先登录' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { groupId } = await context.request.json() as { groupId: string };

        if (!groupId) {
            return new Response(
                JSON.stringify({ success: false, message: '缺少群ID' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const group = await db.prepare(
            'SELECT id, name FROM claw_groups WHERE id = ?'
        ).bind(groupId).first();

        if (!group) {
            return new Response(
                JSON.stringify({ success: false, message: '群聊不存在' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const existing = await db.prepare(
            'SELECT group_id FROM claw_group_users WHERE group_id = ? AND user_id = ?'
        ).bind(groupId, userId).first();

        if (existing) {
            return new Response(
                JSON.stringify({ success: true, message: '已在群中', data: { group } }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        await db.prepare(
            `INSERT INTO claw_group_users (group_id, user_id, role) VALUES (?, ?, 'member')`
        ).bind(groupId, userId).run();

        return new Response(
            JSON.stringify({
                success: true,
                message: '加入成功',
                data: { group }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('claw join error:', error);
        return new Response(
            JSON.stringify({ success: false, message: error.message || '加入失败' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
