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

        const { name, description } = await context.request.json() as {
            name: string;
            description?: string;
        };

        if (!name || !name.trim()) {
            return new Response(
                JSON.stringify({ success: false, message: '群名不能为空' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (name.trim().length > 30) {
            return new Response(
                JSON.stringify({ success: false, message: '群名不能超过30个字符' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const groupId = `claw-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

        await db.prepare(
            `INSERT INTO claw_groups (id, name, description, max_rounds, max_responders, created_by, created_at)
             VALUES (?, ?, ?, 3, 3, ?, CURRENT_TIMESTAMP)`
        ).bind(groupId, name.trim(), description?.trim() || '', userId).run();

        await db.prepare(
            `INSERT INTO claw_group_users (group_id, user_id, role) VALUES (?, ?, 'owner')`
        ).bind(groupId, userId).run();

        const group = await db.prepare(
            'SELECT id, name, description, max_rounds, max_responders, created_by, created_at FROM claw_groups WHERE id = ?'
        ).bind(groupId).first();

        return new Response(
            JSON.stringify({
                success: true,
                data: { group }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('claw create error:', error);
        return new Response(
            JSON.stringify({ success: false, message: error.message || '创建群聊失败' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
