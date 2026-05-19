/// <reference types="@cloudflare/workers-types" />

import { onRequest as apiMiddleware } from './functions/api/_middleware';

// Auth routes
import { onRequestGet as googleLogin } from './functions/api/auth/google/login';
import { onRequestGet as googleCallback } from './functions/api/auth/google/callback';
import { onRequestGet as githubLogin } from './functions/api/auth/github/login';
import { onRequestGet as githubCallback } from './functions/api/auth/github/callback';
import { onRequestGet as linuxdoLogin } from './functions/api/auth/linuxdo/login';
import { onRequestGet as linuxdoCallback } from './functions/api/auth/linuxdo/callback';

// Core API routes
import { onRequestPost as smsLogin } from './functions/api/login';
import { onRequestPost as sendCode } from './functions/api/sendCode';
import { onRequestPost as chat } from './functions/api/chat';
import { onRequestGet as init } from './functions/api/init';
import { onRequestGet as reprompt } from './functions/api/reprompt';
import { onRequestPost as scheduler } from './functions/api/scheduler';
import { onRequestPost as schedulerwho } from './functions/api/schedulerwho';
import { onRequestGet as testDb } from './functions/api/test-db';

// AI Game routes
import { onRequestPost as aiGameJoin } from './functions/api/ai-game/join';
import { onRequestGet as aiGameRoomsGet } from './functions/api/ai-game/rooms';
import { onRequestPost as aiGameRoomsPost } from './functions/api/ai-game/rooms';
import { onRequestPost as aiGameVote } from './functions/api/ai-game/vote';
import { onRequestPost as aiGameReveal } from './functions/api/ai-game/reveal';
import { onRequestPost as aiGameAiTurn } from './functions/api/ai-game/ai-turn';
import { onRequestGet as aiGameMessages } from './functions/api/ai-game/messages';
import { onRequestPost as aiGameStart } from './functions/api/ai-game/start';
import { onRequestPost as aiGameReviews } from './functions/api/ai-game/reviews';
import { onRequestPost as aiGameSend } from './functions/api/ai-game/send';

// User routes
import { onRequestGet as userInfo } from './functions/api/user/info';
import { onRequestPost as userUpdate } from './functions/api/user/update';
import { onRequestPost as userUpload } from './functions/api/user/upload';

// Claw group routes
import { onRequestPost as clawRegister } from './functions/api/claw/register';
import { onRequestPost as clawCreate } from './functions/api/claw/create';
import { onRequestPost as clawJoin } from './functions/api/claw/join';
import { onRequestPost as clawLeave } from './functions/api/claw/leave';
import { onRequestGet as clawMembers } from './functions/api/claw/members';
import { onRequestGet as clawMessages } from './functions/api/claw/messages';
import { onRequestGet as clawPoll } from './functions/api/claw/poll';
import { onRequestPost as clawSend } from './functions/api/claw/send';
import { onRequestPost as clawReply } from './functions/api/claw/reply';
import { onRequestPost as clawRename } from './functions/api/claw/rename';

const routes: Record<string, Function> = {
  // Auth
  'GET /api/auth/google/login': googleLogin,
  'GET /api/auth/google/callback': googleCallback,
  'GET /api/auth/github/login': githubLogin,
  'GET /api/auth/github/callback': githubCallback,
  'GET /api/auth/linuxdo/login': linuxdoLogin,
  'GET /api/auth/linuxdo/callback': linuxdoCallback,

  // Core
  'POST /api/login': smsLogin,
  'POST /api/sendCode': sendCode,
  'POST /api/chat': chat,
  'GET /api/init': init,
  'GET /api/reprompt': reprompt,
  'POST /api/scheduler': scheduler,
  'POST /api/schedulerwho': schedulerwho,
  'GET /api/test-db': testDb,

  // AI Game
  'POST /api/ai-game/join': aiGameJoin,
  'GET /api/ai-game/rooms': aiGameRoomsGet,
  'POST /api/ai-game/rooms': aiGameRoomsPost,
  'POST /api/ai-game/vote': aiGameVote,
  'POST /api/ai-game/reveal': aiGameReveal,
  'POST /api/ai-game/ai-turn': aiGameAiTurn,
  'GET /api/ai-game/messages': aiGameMessages,
  'POST /api/ai-game/start': aiGameStart,
  'POST /api/ai-game/reviews': aiGameReviews,
  'POST /api/ai-game/send': aiGameSend,

  // User
  'GET /api/user/info': userInfo,
  'POST /api/user/update': userUpdate,
  'POST /api/user/upload': userUpload,

  // Claw groups
  'POST /api/claw/register': clawRegister,
  'POST /api/claw/create': clawCreate,
  'POST /api/claw/join': clawJoin,
  'POST /api/claw/leave': clawLeave,
  'GET /api/claw/members': clawMembers,
  'GET /api/claw/messages': clawMessages,
  'GET /api/claw/poll': clawPoll,
  'POST /api/claw/send': clawSend,
  'POST /api/claw/reply': clawReply,
  'POST /api/claw/rename': clawRename,
};

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const routeKey = `${method} ${path}`;

    const handler = routes[routeKey];

    if (handler) {
      const context: any = {
        request,
        env,
        data: {},
        params: {},
        functionPath: path,
        waitUntil: ctx.waitUntil.bind(ctx),
        passThroughOnException: () => {},
        next: async () => handler(context),
      };

      return apiMiddleware(context);
    }

    return env.ASSETS.fetch(request);
  },
};
