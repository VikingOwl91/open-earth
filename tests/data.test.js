import test from 'node:test';
import assert from 'node:assert/strict';
import Data from '../src/data.js';

test('DataStore: lookup functions find features by id and normalized name', () => {
  const store = new Data.DataStore();

  store.volcanoes = {
    type: 'FeatureCollection',
    features: [
      { properties: { Volcano_Number: '332010', Volcano_Name: 'Kilauea', Country: 'United States' } },
      { properties: { Volcano_Number: '262000', Volcano_Name: 'Krakatau', Country: 'Indonesia' } }
    ]
  };

  store.activity = {
    type: 'FeatureCollection',
    features: [
      { properties: { Volcano_Number: '332010', Report_Name: 'Kilauea', Report_Summary: 'Activity ongoing.' } }
    ]
  };

  store.trenches = {
    type: 'FeatureCollection',
    features: [
      { properties: { Name: 'Mariana', Generic: 'Trench' } }
    ]
  };

  store.faults = {
    type: 'FeatureCollection',
    features: [
      { properties: { catalog_id: 'UCF_2', name: 'Mount Diablo Thrust' } }
    ]
  };

  store.plateSteps = {
    type: 'FeatureCollection',
    features: [
      { properties: { SEQNUM: 42, Plate_Pair: 'AF-AN', Boundary_Code: 'OTF' } }
    ]
  };

  store.earthquakes = {
    type: 'FeatureCollection',
    features: [
      { id: 'us7000abcd', properties: { mag: 5.5, place: 'South of Fiji' } }
    ]
  };

  // Test volcano lookup by number and name
  assert.equal(store.findVolcano('332010')?.properties.Volcano_Name, 'Kilauea');
  assert.equal(store.findVolcano('krakatau')?.properties.Volcano_Number, '262000');
  assert.equal(store.findVolcano('999999'), null);

  // Test report lookup
  assert.ok(store.findReportForVolcano({ Volcano_Number: '332010' }));
  assert.equal(store.findReportForVolcano({ Volcano_Number: '262000' }), null);

  // Test trench lookup
  assert.equal(store.findTrench('mariana')?.properties.Name, 'Mariana');
  assert.equal(store.findTrench('mariana-trench')?.properties.Name, 'Mariana');

  // Test fault lookup
  assert.equal(store.findFault('UCF_2')?.properties.name, 'Mount Diablo Thrust');
  assert.equal(store.findFault('Mount Diablo Thrust')?.properties.catalog_id, 'UCF_2');

  // Test boundary lookup
  assert.equal(store.findBoundary('42')?.properties.Plate_Pair, 'AF-AN');

  // Test earthquake lookup
  assert.equal(store.findEarthquake('us7000abcd')?.properties.mag, 5.5);
});

function stubFetch(handler) {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return handler(String(url));
  };
  console.warn = () => {};
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  };
}

const jsonResponse = body => ({ ok: true, json: async () => body });
const failedResponse = status => ({ ok: false, status, json: async () => ({}) });

test('DataStore: fetchSnapshot prefers the GitHub Raw copy and skips the local one', async () => {
  const stub = stubFetch(() => jsonResponse({ type: 'FeatureCollection', features: [] }));
  try {
    const store = new Data.DataStore();
    store.manifest = { generatedAt: new Date().toISOString() };
    assert.ok(await store.fetchSnapshot('volcanoes.json', 'volcanoes'));
    assert.equal(stub.calls.length, 1);
    assert.match(stub.calls[0], /^https:\/\/raw\.githubusercontent\.com\/.+\/data\/volcanoes\.json$/);
    assert.equal(store.snapshotFallbacks.size, 0);
    assert.equal(store.failures.size, 0);
    assert.match(store.getStatusSummary(), /snapshots via GitHub/);
  } finally {
    stub.restore();
  }
});

test('DataStore: fetchSnapshot falls back to the local copy and records it', async () => {
  const stub = stubFetch(url => (url.startsWith('./data/') ? jsonResponse({ ok: 1 }) : failedResponse(503)));
  try {
    const store = new Data.DataStore();
    assert.deepEqual(await store.fetchSnapshot('faults.json', 'faults'), { ok: 1 });
    assert.deepEqual(stub.calls.map(u => u.startsWith('./data/')), [false, true]);
    assert.deepEqual([...store.snapshotFallbacks], ['faults.json']);
    assert.equal(store.failures.has('faults'), false);
    assert.match(store.getStatusSummary(), /local snapshot fallback: faults\.json/);
    ['a.json', 'b.json', 'c.json'].forEach(f => store.snapshotFallbacks.add(f));
    assert.match(store.getStatusSummary(), /local snapshot fallback: 4 files/);
  } finally {
    stub.restore();
  }
});

test('DataStore: fetchSnapshot reports a failure when both copies fail', async () => {
  const stub = stubFetch(() => failedResponse(500));
  try {
    const store = new Data.DataStore();
    assert.equal(await store.fetchSnapshot('trenches.json', 'trenches'), null);
    assert.equal(store.snapshotFallbacks.size, 0);
    assert.equal(store.failures.has('trenches'), true);
    assert.doesNotMatch(store.getStatusSummary(), /snapshots via GitHub/);
  } finally {
    stub.restore();
  }
});
