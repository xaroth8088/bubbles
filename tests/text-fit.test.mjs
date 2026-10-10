import test from 'node:test';
import assert from 'node:assert/strict';
import {largestFittingFont, wholeWords} from '../src/text-fit.js';

test('keeps short clues at the larger maximum', () => {
  assert.equal(largestFittingFont(18, size => size * 2 <= 56), 18);
  assert.equal(largestFittingFont(19, size => size * 2 <= 84), 19);
});
test('fits whole-word width instead of counting arbitrary character lines', () => {
  const font = largestFittingFont(18, size => size * 5.1 <= 54 && size * 1.15 <= 49);
  assert.ok(font <= 54 / 5.1 && font > 54 / 5.1 - .01);
});
test('shrinks long compounds below the old 10px floor when necessary', () => {
  const font = largestFittingFont(18, size => size * 17 <= 47);
  assert.ok(font > 0 && font < 10);
  assert.ok(font * 17 <= 47);
  assert.ok((font + .01) * 17 > 47);
});
test('accounts for phrase lines and each merged term height budget', () => {
  const font = largestFittingFont(19, size => size * 3 <= 82 && size * 1.15 * 2 <= 22);
  assert.ok(font * 2.3 <= 22);
  assert.ok((font + .01) * 2.3 > 22);
});
test('whitespace is the sole break opportunity, including punctuation and hyphens', () => {
  assert.deepEqual(wholeWords("  Hello, Goodbye\tSpider-Man rock’n’roll A/B foo|bar \n Donaudampfschifffahrt  "),
    ['Hello,', 'Goodbye', 'Spider-Man', 'rock’n’roll', 'A/B', 'foo|bar', 'Donaudampfschifffahrt']);
  assert.deepEqual(wholeWords('soft\u00adhyphen'), ['soft\u00adhyphen']);
  assert.deepEqual(wholeWords('   '), []);
});
