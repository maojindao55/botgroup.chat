interface Env {
    bgkv: KVNamespace;
    bgdb: D1Database;
    JWT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
}

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;
        const url = new URL(request.url);

        const redirectUri = `${url.origin}/api/auth/github/callback`;

        const state = crypto.randomUUID();
        await env.bgkv.put(`github_oauth_state:${state}`, '1', {
            expirationTtl: 10 * 60
        });

        const params = new URLSearchParams({
            client_id: env.GITHUB_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: 'read:user user:email',
            state: state,
        });

        return Response.redirect(`${GITHUB_AUTH_URL}?${params.toString()}`, 302);
    } catch (error) {
        console.error('GitHub login error:', error);
        return new Response(
            JSON.stringify({ success: false, message: '发起 GitHub 登录失败' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
