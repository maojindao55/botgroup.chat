import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('./aiGameWords.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`;
const { hashStringToIndex, validateGeneratedUndercoverPair, makeWordPairKey, getDynamicPairLookupOrder } = await import(moduleUrl);

assert.equal(hashStringToIndex('game-a1b2c3d4e5', 97), hashStringToIndex('game-a1b2c3d4e5', 97));
assert.notEqual(hashStringToIndex('game-ab', 97), hashStringToIndex('game-ba', 97));
assert.ok(hashStringToIndex('game-a1b2c3d4e5', 97) >= 0);
assert.ok(hashStringToIndex('game-a1b2c3d4e5', 97) < 97);
assert.equal(hashStringToIndex('anything', 0), 0);

assert.equal(validateGeneratedUndercoverPair('地铁', '高铁').valid, true);
assert.equal(validateGeneratedUndercoverPair('猫', '狗').valid, true);
assert.equal(validateGeneratedUndercoverPair('风筝', '风箏').valid, false);
assert.equal(validateGeneratedUndercoverPair('手机', '手机壳').valid, false);
assert.equal(validateGeneratedUndercoverPair('青团', '汤圆').valid, false);

assert.equal(makeWordPairKey('牛奶', '豆浆'), makeWordPairKey('豆浆', '牛奶'));

assert.deepEqual(getDynamicPairLookupOrder(), ['generate', 'fresh-cache', 'stale-cache', 'fallback']);
