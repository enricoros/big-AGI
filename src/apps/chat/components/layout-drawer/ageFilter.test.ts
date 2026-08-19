import assert from 'node:assert';
import { test } from 'node:test';
import { filterOlderThanMatches, AGE_FILTER_OPTIONS } from './ageFilter';

const NOW = Date.UTC(2026, 7, 18, 12, 0, 0); // fixed reference
const daysAgo = (n: number) => NOW - n * 24 * 60 * 60 * 1000;

test('null cutoff matches everything', () => {
  assert.equal(filterOlderThanMatches(daysAgo(400), null, NOW), true);
  assert.equal(filterOlderThanMatches(daysAgo(0), null, NOW), true);
});

test('14-day cutoff: older matches, newer does not', () => {
  assert.equal(filterOlderThanMatches(daysAgo(15), 14, NOW), true);
  assert.equal(filterOlderThanMatches(daysAgo(13), 14, NOW), false);
});

test('boundary: exactly N days old does NOT match (strictly older)', () => {
  assert.equal(filterOlderThanMatches(daysAgo(30), 30, NOW), false);
  assert.equal(filterOlderThanMatches(daysAgo(30) - 1, 30, NOW), true);
});

test('presets include 7/14/30/90 days', () => {
  assert.deepEqual(AGE_FILTER_OPTIONS.map(o => o.days), [null, 7, 14, 30, 90]);
});
