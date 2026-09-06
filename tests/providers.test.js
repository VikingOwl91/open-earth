import test from 'node:test';
import assert from 'node:assert/strict';
import Providers from '../src/providers.js';

test('Providers: regionalMonitoringForVolcano returns empty array on null input', () => {
  const result = Providers.regionalMonitoringForVolcano(null);
  assert.deepEqual(result, []);
});

test('Providers: relativeAge formats durations accurately', () => {
  const now = Date.now();
  assert.equal(Providers.relativeAge(new Date(now - 1000 * 60 * 10).toISOString()), '< 1h old');
  assert.equal(Providers.relativeAge(new Date(now - 1000 * 60 * 60 * 5).toISOString()), '5h old');
  assert.equal(Providers.relativeAge(new Date(now - 1000 * 60 * 60 * 72).toISOString()), '3d old');
});

test('Providers: conservative matching does not match unrelated volcanoes', () => {
  // Eyjafjallajökull in Iceland should not match US, ID, JP, NZ providers
  const volcano = {
    Volcano_Number: '372020',
    Volcano_Name: 'Eyjafjallajokull',
    Country: 'Iceland'
  };
  const records = Providers.regionalMonitoringForVolcano(volcano);
  assert.deepEqual(records, []);
});
