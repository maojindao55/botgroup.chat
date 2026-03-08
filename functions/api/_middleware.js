async function verifyToken(token, env) {
    try {
        const [headerB64, payloadB64, signature] = token.split('.');
        
        // 验证签名
        const input = `${headerB64}.${payloadB64}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(env.JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        const signatureBytes = Uint8Array.from(atob(
            signature.replace(/-/g, '+').replace(/_/g, '/')
        ), c => c.charCodeAt(0));
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            encoder.encode(input)
        );
        
        if (!isValid) {
            throw new Error('Invalid signature');
        }
        
        // 解码 payload
        const payload = JSON.parse(atob(
            payloadB64.replace(/-/g, '+').replace(/_/g, '/')
        ));
        
        // 检查过期时间
        if (payload.exp < Math.floor(Date.now() / 1000)) {
            throw new Error('Token expired');
        }
        
        return payload;
    } catch (error) {
        throw new Error('Invalid token');
    }
}

// 中间件函数
export async function onRequest(context) {
    try {
        const authAccess = context.env.AUTH_ACCESS;
        console.log('authAccess', authAccess);
        
        if (!authAccess || authAccess === '0' || context.request.url.includes('/login') || context.request.url.includes('/sendcode') || context.request.url.includes('/test-db') || context.request.url.includes('/claw/') || context.request.url.includes('/auth/')) {
            console.log('跳过权限校验');
            // 尝试解析 token（如果有），但不强制要求
            const authHeader = context.request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const payload = await verifyToken(token, context.env);
                    context.data = { user: payload };
                } catch (e) {
                    context.data = { user: null };
                }
            } else {
                context.data = { user: null };
            }
            return context.next();
        }

        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('No token provided');
        }
        
        const token = authHeader.split(' ')[1];
        const payload = await verifyToken(token, context.env);
        
        // 直接在原有的 request 对象上添加 context
        context.data = { user: payload };
        console.log('context.request.user', context.data);
        return context.next();
    } catch (error) {
        console.error(error.message, context.request.url);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 401,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
