import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameJoin.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { resolveAiGameJoinType } = await import(moduleUrl);

assert.deepEqual(resolveAiGameJoinType({ requested: 'observer', roomStatus: 'waiting' }), {
  playerType: 'observer',
  downgraded: false,
});

assert.deepEqual(resolveAiGameJoinType({ requested: 'observer', roomStatus: 'playing' }), {
  playerType: 'observer',
  downgraded: false,
});

assert.deepEqual(resolveAiGameJoinType({ requested: 'observer', roomStatus: 'revealed' }), {
  playerType: 'observer',
  downgraded: false,
});

assert.deepEqual(resolveAiGameJoinType({ requested: 'player', roomStatus: 'waiting' }), {
  playerType: 'human',
  downgraded: false,
});

assert.deepEqual(resolveAiGameJoinType({ requested: 'player', roomStatus: 'playing' }), {
  playerType: 'observer',
  downgraded: true,
  message: '游戏已开始，已切换为围观模式',
});
