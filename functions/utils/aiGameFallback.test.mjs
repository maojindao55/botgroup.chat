import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameFallback.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { generateUndercoverFallbackReply } = await import(moduleUrl);

const reply = generateUndercoverFallbackReply({
  playerId: 'ai-1',
  word: '牛奶',
  messageCount: 7,
  ownTurnCount: 2,
});

assert.equal(typeof reply, 'string');
assert.ok(reply.length > 0);
assert.ok(reply.length <= 90);
assert.equal(reply.includes('牛奶'), false);

assert.equal(
  generateUndercoverFallbackReply({
    playerId: 'ai-1',
    word: '牛奶',
    messageCount: 7,
    ownTurnCount: 2,
  }),
  reply,
);
