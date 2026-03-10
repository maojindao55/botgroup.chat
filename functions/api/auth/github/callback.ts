interface Env {
    bgkv: KVNamespace;
    bgdb: D1Database;
    JWT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
}

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;
        const url = new URL(request.url);

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
            return redirectToLogin(url.origin, '用户取消了 GitHub 登录');
        }

        if (!code || !state) {
            return redirectToLogin(url.origin, '无效的回调参数');
        }

        const storedState = await env.bgkv.get(`github_oauth_state:${state}`);
        if (!storedState) {
            return redirectToLogin(url.origin, '登录状态已过期，请重试');
        }
        await env.bgkv.delete(`github_oauth_state:${state}`);

        const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: `${url.origin}/api/auth/github/callback`,
            }),
        });

        if (!tokenResponse.ok) {
            console.error('GitHub token exchange failed:', await tokenResponse.text());
            return redirectToLogin(url.origin, 'GitHub 登录失败，请重试');
        }

        const tokenData: any = await tokenResponse.json();
        if (tokenData.error) {
            console.error('GitHub token error:', tokenData.error_description);
            return redirectToLogin(url.origin, 'GitHub 登录失败，请重试');
        }

        const accessToken = tokenData.access_token;

        const userResponse = await fetch(GITHUB_USER_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'botgroup-chat',
            },
        });

        if (!userResponse.ok) {
            console.error('GitHub userinfo failed:', await userResponse.text());
            return redirectToLogin(url.origin, '获取用户信息失败');
        }

        const githubUser: any = await userResponse.json();
        const { id: githubId, login: githubUsername, name, avatar_url: avatarUrl } = githubUser;

        if (!githubId) {
            return redirectToLogin(url.origin, '无法获取 GitHub 用户信息');
        }

        const db = env.bgdb;
        let user = await db.prepare(
            "SELECT id, phone, nickname, avatar_url, status, github_id, github_username FROM users WHERE github_id = ?"
        ).bind(String(githubId)).first();

        if (!user) {
            const nickname = name || githubUsername || 'GitHub用户';

            await db.prepare(`
                INSERT INTO users (phone, nickname, avatar_url, github_id, github_username, status, created_at, updated_at, last_login_at)
                VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(`github_${githubId}`, nickname, avatarUrl || null, String(githubId), githubUsername || '').run();

            user = await db.prepare(
                "SELECT id, phone, nickname, avatar_url, status, github_id, github_username FROM users WHERE github_id = ?"
            ).bind(String(githubId)).first();
        } else {
            await db.prepare(`
                UPDATE users 
                SET last_login_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    avatar_url = COALESCE(avatar_url, ?),
                    nickname = CASE WHEN nickname LIKE 'GitHub用户%' OR nickname = '' THEN ? ELSE nickname END,
                    github_username = ?
                WHERE github_id = ?
            `).bind(avatarUrl || null, name || githubUsername || '', githubUsername || '', String(githubId)).run();
        }

        if (!user) {
            return redirectToLogin(url.origin, '创建用户失败');
        }

        const token = await generateToken(String(user.id), env);

        return Response.redirect(`${url.origin}/login?github_token=${encodeURIComponent(token)}`, 302);

    } catch (error: any) {
        console.error('GitHub callback error:', error?.message, error?.stack);
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
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
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
