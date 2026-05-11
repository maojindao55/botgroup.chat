interface Env {
    bgkv: KVNamespace;
    bgdb: D1Database;
    JWT_SECRET: string;
    LINUXDO_CLIENT_ID: string;
    LINUXDO_CLIENT_SECRET: string;
}

const LINUXDO_AUTH_URL = 'https://connect.linux.do/oauth2/authorize';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;
        const url = new URL(request.url);

        const redirectUri = `${url.origin}/api/auth/linuxdo/callback`;

        // 生成 state 防 CSRF
        const state = crypto.randomUUID();
        await env.bgkv.put(`linuxdo_oauth_state:${state}`, '1', {
            expirationTtl: 10 * 60 // 10分钟过期
        });

        const params = new URLSearchParams({
            client_id: env.LINUXDO_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            state: state,
        });

        const authUrl = `${LINUXDO_AUTH_URL}?${params.toString()}`;

        return Response.redirect(authUrl, 302);
    } catch (error) {
        console.error('LinuxDo login error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                message: '发起 Linux.do 登录失败'
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
