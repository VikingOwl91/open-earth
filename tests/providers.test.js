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

test('Providers: IMO status matches by GVP number and keeps VALS and ACC separate', () => {
  Providers.providers.imo.fetchedAt = new Date().toISOString();
  Providers.providers.imo.statuses = [{
    providerId: 'imo', name: 'Reykjanes', volcanoId: 'REY', volcanoNumber: 371020, matchingMethod: 'official_si_code',
    level: 'VALS 2', levelName: 'Orange', colorCode: 'YELLOW', label: 'VALS 2 · ORANGE · ACC YELLOW',
    nativeStatus: 'VALS 2 Orange - Heightened volcanic unrest; Aviation Color Code YELLOW', severity: 'watch'
  }];
  try {
    const hit = Providers.regionalMonitoringForVolcano({ Volcano_Number: '371020', Volcano_Name: 'Reykjanes', Country: 'Iceland' });
    assert.equal(hit.length, 1);
    assert.equal(hit[0].providerId, 'imo');
    assert.equal(hit[0].level, 'VALS 2');
    assert.equal(hit[0].colorCode, 'YELLOW');
    assert.equal(hit[0].severity, 'watch');
    const other = Providers.regionalMonitoringForVolcano({ Volcano_Number: '371020', Volcano_Name: 'Reykjanes', Country: 'Japan' });
    assert.deepEqual(other, []);
  } finally {
    Providers.providers.imo.statuses = [];
    Providers.providers.imo.fetchedAt = null;
  }
});
