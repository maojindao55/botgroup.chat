import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./share.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { buildAiGameChallengeUrl, parseChallengeLevel } = await import(moduleUrl);

assert.equal(buildAiGameChallengeUrl('https://example.com/ai-game/game-123?observe=1', 7), 'https://example.com/ai-game?challenge=7');
assert.equal(buildAiGameChallengeUrl('https://example.com/ai-game', 0), 'https://example.com/ai-game');
assert.equal(parseChallengeLevel('?challenge=12'), 12);
assert.equal(parseChallengeLevel('?challenge=abc'), null);
assert.equal(parseChallengeLevel('?challenge=-1'), null);
