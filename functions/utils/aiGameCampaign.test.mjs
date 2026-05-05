import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameCampaign.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { isCampaignRoom, normalizeCampaignWordTier, resolveCampaignWordTier, sanitizeCampaignTitle } = await import(moduleUrl);

assert.equal(normalizeCampaignWordTier('obvious'), 'obvious');
assert.equal(normalizeCampaignWordTier('bad-tier'), null);

assert.equal(isCampaignRoom({ mode: 'undercover', campaign_level: 3, title: '普通房间' }), true);
assert.equal(isCampaignRoom({ mode: 'undercover', title: '卧底晋级赛 · 相近词陷阱' }), true);
assert.equal(isCampaignRoom({ mode: 'jury', campaign_level: 3, title: '卧底晋级赛 · 相近词陷阱' }), false);

assert.equal(resolveCampaignWordTier({ word_tier: 'contextual', title: '卧底晋级赛 · X [tier:close]' }), 'contextual');
assert.equal(resolveCampaignWordTier({ title: '卧底晋级赛 · X [tier:abstract]' }), 'abstract');
assert.equal(resolveCampaignWordTier({ title: '卧底晋级赛 · X' }), 'close');

assert.equal(sanitizeCampaignTitle('卧底晋级赛 · X [tier:abstract]'), '卧底晋级赛 · X');
