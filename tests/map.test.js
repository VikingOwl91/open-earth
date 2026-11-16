import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import MapModule from '../src/map.js';
import Data from '../src/data.js';

test('map module: EMPTY is a valid, frozen GeoJSON FeatureCollection', () => {
  const { EMPTY } = MapModule;
  assert.equal(EMPTY.type, 'FeatureCollection');
  assert.ok(Array.isArray(EMPTY.features));
  assert.equal(EMPTY.features.length, 0);
  assert.ok(Object.isFrozen(EMPTY));
  assert.deepEqual(EMPTY, Data.EMPTY);
});

test('map module: DataStore has no EMPTY, so map.js must not read it from the store', () => {
  assert.equal(new Data.DataStore().EMPTY, undefined);
  const src = readFileSync(new URL('../src/map.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(?:ds|dataStore)\.EMPTY\b/);
});
