import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameCampaignResult.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { calculateCampaignStars } = await import(moduleUrl);

assert.equal(calculateCampaignStars({
  playerGuessCorrect: true,
  groupSucceeded: false,
  humanRole: 'civilian',
}), 0);

assert.equal(calculateCampaignStars({
  playerGuessCorrect: false,
  groupSucceeded: true,
  humanRole: 'civilian',
}), 0);

assert.equal(calculateCampaignStars({
  playerGuessCorrect: true,
  groupSucceeded: true,
  humanRole: 'civilian',
  eliminatedRole: 'undercover',
  remainingCount: 4,
  durationSeconds: 240,
  secondsUsed: 220,
}), 2);

assert.equal(calculateCampaignStars({
  playerGuessCorrect: true,
  groupSucceeded: true,
  humanRole: 'undercover',
  eliminatedRole: 'civilian',
  eliminatedIsHuman: false,
  remainingCount: 5,
  durationSeconds: 240,
  secondsUsed: 200,
}), 3);

assert.equal(calculateCampaignStars({
  playerGuessCorrect: true,
  groupSucceeded: true,
  humanRole: 'civilian',
  eliminatedRole: 'undercover',
  remainingCount: 4,
  durationSeconds: 240,
  secondsUsed: 100,
}), 3);
