import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
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
  const warnings = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    return handler(String(url), opts);
  };
  console.warn = (...args) => warnings.push(args);
  return {
    calls,
    warnings,
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

const remoteMs = Data.REMOTE_SNAPSHOT_TIMEOUTS;
const localMs = Data.LOCAL_SNAPSHOT_TIMEOUTS;
const flush = () => new Promise(resolve => setImmediate(resolve));
const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
const isLocal = url => url.startsWith('./data/');

function hang(opts) {
  return new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(abortError()));
  });
}

test('DataStore: the snapshot timeouts are positive and the local one is the more generous', () => {
  assert.ok(remoteMs.headerMs > 0 && remoteMs.bodyMs > 0);
  assert.ok(localMs.headerMs > remoteMs.headerMs);
  assert.ok(Data.LIVE_TIMEOUTS.headerMs > 0);
});

test('DataStore: a GitHub Raw request that never answers times out and falls back to the local copy', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const signals = [];
  const stub = stubFetch((url, opts) => {
    signals.push(opts.signal);
    return isLocal(url) ? jsonResponse({ local: true }) : hang(opts);
  });
  try {
    const store = new Data.DataStore();
    const pending = store.fetchSnapshot('plates.json', 'plates');
    await flush();
    assert.equal(stub.calls.length, 1);
    mock.timers.tick(remoteMs.headerMs - 1);
    await flush();
    assert.equal(stub.calls.length, 1);
    assert.equal(signals[0].aborted, false);
    mock.timers.tick(1);
    assert.deepEqual(await pending, { local: true });
    assert.equal(signals[0].aborted, true);
    assert.deepEqual(stub.calls.map(isLocal), [false, true]);
    assert.deepEqual([...store.snapshotFallbacks], ['plates.json']);
    assert.equal(store.failures.has('plates'), false);
    assert.match(store.getStatusSummary(), /local snapshot fallback: plates\.json/);
    assert.match(String(stub.warnings[0][0]), /timed out waiting for response headers after 4000 ms/);
  } finally {
    stub.restore();
    mock.timers.reset();
  }
});

test('DataStore: a GitHub Raw copy that answers before the timeout is used and nothing fires afterwards', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const signals = [];
  let answer;
  const stub = stubFetch((url, opts) => {
    signals.push(opts.signal);
    return new Promise(resolve => { answer = () => resolve(jsonResponse({ remote: true })); });
  });
  try {
    const store = new Data.DataStore();
    const pending = store.fetchSnapshot('volcanoes.json', 'volcanoes');
    await flush();
    mock.timers.tick(remoteMs.headerMs - 1);
    answer();
    assert.deepEqual(await pending, { remote: true });
    mock.timers.tick(remoteMs.bodyMs + localMs.headerMs + remoteMs.headerMs);
    await flush();
    assert.equal(signals[0].aborted, false);
    assert.equal(stub.calls.length, 1);
    assert.equal(store.snapshotFallbacks.size, 0);
    assert.equal(store.failures.size, 0);
    assert.equal(stub.warnings.length, 0);
  } finally {
    stub.restore();
    mock.timers.reset();
  }
});

test('DataStore: a slow body within the budget is not aborted, a stalled body falls back to local', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let release;
  const stub = stubFetch((url, opts) => {
    if (isLocal(url)) return jsonResponse({ local: true });
    return {
      ok: true,
      json: () => new Promise((resolve, reject) => {
        release = () => resolve({ slow: true });
        opts.signal.addEventListener('abort', () => reject(abortError()));
      })
    };
  });
  try {
    const store = new Data.DataStore();
    const slow = store.fetchSnapshot('plate-steps.json', 'plateSteps');
    await flush();
    mock.timers.tick(remoteMs.bodyMs - 1);
    release();
    assert.deepEqual(await slow, { slow: true });
    assert.equal(store.snapshotFallbacks.size, 0);

    const stalled = store.fetchSnapshot('plate-polygons.json', 'platePolygons');
    await flush();
    mock.timers.tick(remoteMs.bodyMs);
    assert.deepEqual(await stalled, { local: true });
    assert.deepEqual([...store.snapshotFallbacks], ['plate-polygons.json']);
    assert.match(String(stub.warnings[0][0]), /timed out downloading the body after 60000 ms/);
  } finally {
    stub.restore();
    mock.timers.reset();
  }
});

test('DataStore: fetchSnapshot returns null and reports a failure when both copies time out', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const stub = stubFetch((url, opts) => hang(opts));
  try {
    const store = new Data.DataStore();
    const pending = store.fetchSnapshot('trenches.json', 'trenches');
    await flush();
    mock.timers.tick(remoteMs.headerMs);
    await flush();
    assert.equal(stub.calls.length, 2);
    assert.equal(isLocal(stub.calls[1]), true);
    mock.timers.tick(localMs.headerMs - 1);
    await flush();
    assert.equal(store.failures.has('trenches'), true);
    mock.timers.tick(1);
    assert.equal(await pending, null);
    assert.equal(store.snapshotFallbacks.size, 0);
    assert.equal(store.failures.has('trenches'), true);
    assert.doesNotMatch(store.getStatusSummary(), /snapshots via GitHub/);
    assert.match(String(stub.warnings[1][0]), /timed out waiting for response headers after 10000 ms/);
  } finally {
    stub.restore();
    mock.timers.reset();
  }
});

test('DataStore: an AbortError that did not come from the timer is handled as a plain failure', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const stub = stubFetch(url => {
    if (isLocal(url)) return jsonResponse({ local: true });
    throw abortError();
  });
  try {
    const store = new Data.DataStore();
    assert.deepEqual(await store.fetchSnapshot('faults.json', 'faults'), { local: true });
    assert.deepEqual([...store.snapshotFallbacks], ['faults.json']);
    assert.doesNotMatch(String(stub.warnings[0][0]), /timed out/);
    assert.equal(await store.fetchJson('https://example.test/x.json', 'x'), null);
    assert.equal(store.failures.has('x'), true);
  } finally {
    stub.restore();
    mock.timers.reset();
  }
});

test('DataStore: a live USGS request that never answers times out and reports a failure', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const stub = stubFetch((url, opts) => hang(opts));
  try {
    const store = new Data.DataStore();
    const pending = store.loadEarthquakes('day');
    await flush();
    mock.timers.tick(Data.LIVE_TIMEOUTS.headerMs);
    const result = await pending;
    assert.equal(result.features.length, 0);
    assert.equal(store.failures.has('earthquakes'), true);
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
    mock.timers.reset();
  }
});
