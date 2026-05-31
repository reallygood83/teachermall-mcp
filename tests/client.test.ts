import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractPriceCandidates,
  getMeaningfulQueryTokens,
  normalizeSearchToken,
} from '../src/api/client.js';

test('extractPriceCandidates keeps separate won amounts instead of concatenating page text', () => {
  const text = '정가 2,500원 판매가 2,000원 배송비 3,000원 총 결제금액 15만원 이상';

  assert.deepEqual(extractPriceCandidates(text), [2500, 2000, 3000]);
});

test('extractPriceCandidates ignores impossible concatenated prices', () => {
  const text = '112,500,200,020,002,000,000,000,000원';

  assert.deepEqual(extractPriceCandidates(text), []);
});

test('getMeaningfulQueryTokens removes grade-only noise from recommendation queries', () => {
  assert.deepEqual(getMeaningfulQueryTokens('3학년 화산 실험'), ['화산', '실험']);
  assert.equal(normalizeSearchToken('  [화산]   실험  '), '화산 실험');
});
