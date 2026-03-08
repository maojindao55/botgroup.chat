// 临时调试接口，确认后删除
export const onRequestGet: PagesFunction = async (context) => {
    const env = context.env;
    return Response.json({
        has_GOOGLE_CLIENT_ID: !!env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_ID_prefix: env.GOOGLE_CLIENT_ID ? env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'undefined',
        has_GOOGLE_CLIENT_SECRET: !!env.GOOGLE_CLIENT_SECRET,
        env_keys: Object.keys(env).sort(),
    });
};
