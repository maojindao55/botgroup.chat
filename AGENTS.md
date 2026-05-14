# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

botgroup.chat is an AI multi-player group chat platform built with React 18 + Vite (frontend) and Cloudflare Pages Functions (backend/serverless). It uses Cloudflare D1 (SQLite) as the database and KV for OAuth state.

### Quick Reference

- **Package manager**: npm (lockfile: `package-lock.json`)
- **Dev server**: `npx wrangler pages dev -- npm run dev` (serves at `http://localhost:8788`)
- **Build**: `npm run build` (output in `dist/`)
- **Frontend only**: `npm run dev` (Vite on port 3000, no backend)
- **DB migrations**: `npx wrangler d1 migrations apply friends --local`

### Dev Environment Setup Notes

1. **wrangler is a local devDependency** — always use `npx wrangler` instead of bare `wrangler`. The `init-db.sh` and `devrun.sh` scripts use bare `wrangler` and will fail unless you adjust them.

2. **Database init**: Run `npx wrangler d1 migrations apply friends --local` to create/update the local D1 database. The old `init-db.sh` script uses deprecated wrangler v3 flags (`--local`, `--persist-to`) that no longer work in wrangler v4+.

3. **Environment variables**: Create a `.dev.vars` file in the project root with at least:
   ```
   JWT_SECRET=<any-string-for-local-dev>
   ```
   Optionally add LLM API keys (`DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, etc.) for AI responses to work.

4. **Auth bypass for dev**: The app uses `AUTH_ACCESS` in `public/config.js` (default `"1"` = login required). To access the chat UI without OAuth, generate a JWT token signed with your `JWT_SECRET` and set it in `localStorage('token')`. The JWT payload needs a `userId` field.

5. **No ESLint or test scripts**: The project does not have ESLint configuration or test scripts defined in `package.json`. There is a `playwright` devDependency but no test files or config.

6. **TypeScript**: The project uses TypeScript but has no `tsc --noEmit` check script. Vite build (`npm run build`) performs type-free bundling — it will catch import/syntax errors but not type errors.
