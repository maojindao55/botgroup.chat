interface Env {
    bgkv: KVNamespace;
    bgdb: D1Database;
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;
        const url = new URL(request.url);

        const redirectUri = `${url.origin}/api/auth/google/callback`;

        // 生成 state 防 CSRF
        const state = crypto.randomUUID();
        await env.bgkv.put(`google_oauth_state:${state}`, '1', {
            expirationTtl: 10 * 60 // 10分钟过期
        });

        const params = new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state: state,
            access_type: 'offline',
            prompt: 'select_account',
        });

        const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

        return Response.redirect(authUrl, 302);
    } catch (error) {
        console.error('Google login error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                message: '发起 Google 登录失败'
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
