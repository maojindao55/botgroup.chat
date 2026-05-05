import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGame.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { generateCampaignLevel } = await import(moduleUrl);

assert.equal(generateCampaignLevel(20).undercoverCount, 1);
assert.equal(generateCampaignLevel(21).undercoverCount, 2);
assert.equal(generateCampaignLevel(21).maxPlayers >= 6, true);
assert.equal(generateCampaignLevel(28).undercoverCount, 2);
assert.equal(generateCampaignLevel(29).undercoverCount, 1);
