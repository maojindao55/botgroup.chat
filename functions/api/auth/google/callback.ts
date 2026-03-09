interface Env {
    bgkv: KVNamespace;
    bgdb: D1Database;
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;
        const url = new URL(request.url);

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // 用户拒绝授权
        if (error) {
            return redirectToLogin(url.origin, '用户取消了 Google 登录');
        }

        if (!code || !state) {
            return redirectToLogin(url.origin, '无效的回调参数');
        }

        // 验证 state 防 CSRF
        const storedState = await env.bgkv.get(`google_oauth_state:${state}`);
        if (!storedState) {
            return redirectToLogin(url.origin, '登录状态已过期，请重试');
        }
        // 清除已用的 state
        await env.bgkv.delete(`google_oauth_state:${state}`);

        const redirectUri = `${url.origin}/api/auth/google/callback`;

        // 用 code 换取 access_token
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Google token exchange failed:', errorData);
            return redirectToLogin(url.origin, 'Google 登录失败，请重试');
        }

        const tokenData: any = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 获取用户信息
        const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!userInfoResponse.ok) {
            console.error('Google userinfo failed:', await userInfoResponse.text());
            return redirectToLogin(url.origin, '获取用户信息失败');
        }

        const googleUser: any = await userInfoResponse.json();
        const { id: googleId, email, name, picture } = googleUser;

        if (!googleId) {
            return redirectToLogin(url.origin, '无法获取 Google 用户信息');
        }

        // 查找或创建用户
        const db = env.bgdb;
        let user = await db.prepare(
            "SELECT id, phone, nickname, avatar_url, status, google_id, google_email FROM users WHERE google_id = ?"
        ).bind(googleId).first();

        if (!user) {
            // 如果有 email，尝试通过 email 关联已有用户（可选逻辑）
            // 新建用户
            const nickname = name || email || `Google用户`;
            const avatarUrl = picture || null;

            const result = await db.prepare(`
                INSERT INTO users (phone, nickname, avatar_url, google_id, google_email, status, created_at, updated_at, last_login_at)
                VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(null, nickname, avatarUrl, googleId, email || '').run();

            user = await db.prepare(
                "SELECT id, phone, nickname, avatar_url, status, google_id, google_email FROM users WHERE google_id = ?"
            ).bind(googleId).first();
        } else {
            // 更新登录时间和可能更新的头像/昵称
            await db.prepare(`
                UPDATE users 
                SET last_login_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    avatar_url = COALESCE(avatar_url, ?),
                    nickname = CASE WHEN nickname LIKE 'Google用户%' OR nickname = '' THEN ? ELSE nickname END
                WHERE google_id = ?
            `).bind(picture || null, name || '', googleId).run();
        }

        if (!user) {
            return redirectToLogin(url.origin, '创建用户失败');
        }

        // 生成 JWT token
        const token = await generateToken(String(user.id), env);

        // 重定向到前端，带上 token
        const loginSuccessUrl = `${url.origin}/login?google_token=${encodeURIComponent(token)}`;
        return Response.redirect(loginSuccessUrl, 302);

    } catch (error: any) {
        console.error('Google callback error:', error?.message, error?.stack, error);
        const url = new URL(context.request.url);
        const errMsg = error?.message || 'Unknown error';
        return redirectToLogin(url.origin, `登录失败: ${errMsg}`);
    }
};

function redirectToLogin(origin: string, message: string): Response {
    const loginUrl = `${origin}/login?error=${encodeURIComponent(message)}`;
    return Response.redirect(loginUrl, 302);
}

// JWT token 生成（与 login.ts 保持一致）
async function generateToken(userId: string, env: Env): Promise<string> {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

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

        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(input)
        );

        return btoa(String.fromCharCode(...new Uint8Array(signature)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const headerEncoded = encodeBase64Url(header);
    const payloadEncoded = encodeBase64Url(payload);

    const signature = await generateSignature(
        `${headerEncoded}.${payloadEncoded}`,
        env.JWT_SECRET
    );

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
}
