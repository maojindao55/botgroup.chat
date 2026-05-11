interface Env {
    bgkv: KVNamespace;
    bgdb: D1Database;
    JWT_SECRET: string;
    LINUXDO_CLIENT_ID: string;
    LINUXDO_CLIENT_SECRET: string;
}

const LINUXDO_TOKEN_URL = 'https://connect.linux.do/oauth2/token';
const LINUXDO_USER_URL = 'https://connect.linux.do/api/user';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;
        const url = new URL(request.url);

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
            return redirectToLogin(url.origin, '用户取消了 Linux.do 登录');
        }

        if (!code || !state) {
            return redirectToLogin(url.origin, '无效的回调参数');
        }

        // 验证 state 防 CSRF
        const storedState = await env.bgkv.get(`linuxdo_oauth_state:${state}`);
        if (!storedState) {
            return redirectToLogin(url.origin, '登录状态已过期，请重试');
        }
        await env.bgkv.delete(`linuxdo_oauth_state:${state}`);

        const redirectUri = `${url.origin}/api/auth/linuxdo/callback`;

        // 用 code 换取 access_token（使用 Basic Auth）
        const credentials = btoa(`${env.LINUXDO_CLIENT_ID}:${env.LINUXDO_CLIENT_SECRET}`);
        const tokenResponse = await fetch(LINUXDO_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('LinuxDo token exchange failed:', errorData);
            return redirectToLogin(url.origin, 'Linux.do 登录失败，请重试');
        }

        const tokenData: any = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error('LinuxDo token response missing access_token:', tokenData);
            return redirectToLogin(url.origin, 'Linux.do 登录失败，请重试');
        }

        // 获取用户信息
        const userInfoResponse = await fetch(LINUXDO_USER_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!userInfoResponse.ok) {
            console.error('LinuxDo userinfo failed:', await userInfoResponse.text());
            return redirectToLogin(url.origin, '获取用户信息失败');
        }

        const linuxdoUser: any = await userInfoResponse.json();
        const { id: linuxdoId, username, name, avatar_url: avatarUrl } = linuxdoUser;

        if (!linuxdoId) {
            return redirectToLogin(url.origin, '无法获取 Linux.do 用户信息');
        }

        // 查找或创建用户
        const db = env.bgdb;
        let user = await db.prepare(
            "SELECT id, phone, nickname, avatar_url, status, linuxdo_id, linuxdo_username FROM users WHERE linuxdo_id = ?"
        ).bind(String(linuxdoId)).first();

        if (!user) {
            const nickname = name || username || 'LinuxDo用户';
            const avatar = avatarUrl || null;

            await db.prepare(`
                INSERT INTO users (phone, nickname, avatar_url, linuxdo_id, linuxdo_username, status, created_at, updated_at, last_login_at)
                VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(`linuxdo_${linuxdoId}`, nickname, avatar, String(linuxdoId), username || '').run();

            user = await db.prepare(
                "SELECT id, phone, nickname, avatar_url, status, linuxdo_id, linuxdo_username FROM users WHERE linuxdo_id = ?"
            ).bind(String(linuxdoId)).first();
        } else {
            // 更新登录时间和可能更新的头像/昵称
            await db.prepare(`
                UPDATE users 
                SET last_login_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    avatar_url = COALESCE(avatar_url, ?),
                    nickname = CASE WHEN nickname LIKE 'LinuxDo用户%' OR nickname = '' THEN ? ELSE nickname END,
                    linuxdo_username = ?
                WHERE linuxdo_id = ?
            `).bind(avatarUrl || null, name || username || '', username || '', String(linuxdoId)).run();
        }

        if (!user) {
            return redirectToLogin(url.origin, '创建用户失败');
        }

        // 生成 JWT token
        const token = await generateToken(String(user.id), env);

        return Response.redirect(`${url.origin}/login?linuxdo_token=${encodeURIComponent(token)}`, 302);

    } catch (error: any) {
        console.error('LinuxDo callback error:', error?.message, error?.stack);
        const url = new URL(context.request.url);
        return redirectToLogin(url.origin, `登录失败: ${error?.message || 'Unknown error'}`);
    }
};

function redirectToLogin(origin: string, message: string): Response {
    return Response.redirect(`${origin}/login?error=${encodeURIComponent(message)}`, 302);
}

async function generateToken(userId: string, env: Env): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        userId,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7天过期
        iat: Math.floor(Date.now() / 1000)
    };

    const encodeBase64Url = (data: object) => {
        return btoa(JSON.stringify(data))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const generateSignature = async (input: string, secret: string) => {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(input));
        return btoa(String.fromCharCode(...new Uint8Array(signature)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const headerEncoded = encodeBase64Url(header);
    const payloadEncoded = encodeBase64Url(payload);
    const signature = await generateSignature(`${headerEncoded}.${payloadEncoded}`, env.JWT_SECRET);

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
}
