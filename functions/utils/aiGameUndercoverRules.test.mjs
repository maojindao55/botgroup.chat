import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameUndercoverRules.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const {
  evaluateUndercoverRound,
  isPlayerVoteDirectionCorrect,
  normalizeUndercoverCount,
  pickUndercoverIndexes,
} = await import(moduleUrl);

assert.equal(normalizeUndercoverCount(2, 5), 1);
assert.equal(normalizeUndercoverCount(2, 6), 2);
assert.equal(normalizeUndercoverCount(9, 7), 2);

const indexes = pickUndercoverIndexes('game-test', 6, 2);
assert.equal(indexes.length, 2);
assert.equal(new Set(indexes).size, 2);
assert.deepEqual(indexes, pickUndercoverIndexes('game-test', 6, 2));

assert.deepEqual(evaluateUndercoverRound({
  eliminatedRole: 'undercover',
  remainingRoles: ['civilian', 'civilian', 'civilian', 'undercover'],
}), {
  remainingUndercoverCount: 1,
  remainingCivilianCount: 3,
  civilianWin: false,
  undercoverWin: false,
  gameOver: false,
});

assert.equal(evaluateUndercoverRound({
  eliminatedRole: 'undercover',
  remainingRoles: ['civilian', 'civilian', 'civilian'],
}).civilianWin, true);

assert.equal(evaluateUndercoverRound({
  eliminatedRole: 'civilian',
  remainingRoles: ['civilian', 'undercover'],
}).undercoverWin, true);

assert.deepEqual(evaluateUndercoverRound({
  eliminatedRole: 'undercover',
  eliminatedIsHuman: true,
  humanRole: 'undercover',
  remainingRoles: ['civilian', 'civilian', 'civilian'],
}), {
  remainingUndercoverCount: 0,
  remainingCivilianCount: 3,
  civilianWin: true,
  undercoverWin: false,
  gameOver: true,
});

assert.equal(evaluateUndercoverRound({
  eliminatedRole: 'civilian',
  eliminatedIsHuman: true,
  humanRole: 'civilian',
  remainingRoles: ['undercover', 'civilian', 'civilian', 'civilian'],
}).undercoverWin, true);

assert.equal(isPlayerVoteDirectionCorrect('civilian', 'undercover'), true);
assert.equal(isPlayerVoteDirectionCorrect('undercover', 'civilian'), true);
assert.equal(isPlayerVoteDirectionCorrect('undercover', 'undercover'), false);
