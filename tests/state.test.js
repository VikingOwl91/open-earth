import test from 'node:test';
import assert from 'node:assert/strict';
import State from '../src/state.js';
import Geo from '../src/geo.js';

test('Geo: esc should escape HTML characters', () => {
  assert.equal(Geo.esc('<script>"alert(\'x\') & fun"</script>'), '&lt;script&gt;&quot;alert(&#39;x&#39;) &amp; fun&quot;&lt;/script&gt;');
  assert.equal(Geo.esc(null), 'Unknown');
});

test('Geo: norm should normalize diacritics and casing', () => {
  assert.equal(Geo.norm('Kīlauea'), 'kilauea');
  assert.equal(Geo.norm('Anak Krakatau!'), 'anakkrakatau');
});

test('Geo: haversine calculates realistic distance', () => {
  // London to Paris: approx 340 km
  const d = Geo.haversine([0.1278, 51.5074], [2.3522, 48.8566]);
  assert.ok(d > 330 && d < 350, `Expected ~340km, got ${d}`);
});

test('State: getFeatureIdentity identifies stable keys', () => {
  // Volcano by Volcano_Number
  const v1 = State.getFeatureIdentity('volcanoes', { properties: { Volcano_Number: '332010', Volcano_Name: 'Kilauea' } });
  assert.deepEqual(v1, { type: 'volcano', id: '332010' });

  // Volcano by name fallback
  const v2 = State.getFeatureIdentity('volcanoes', { properties: { Volcano_Name: 'Anak Krakatau' } });
  assert.deepEqual(v2, { type: 'volcano', id: 'anak-krakatau' });

  // Earthquake by id
  const eq = State.getFeatureIdentity('earthquakes', { id: 'us7000abcd', properties: { mag: 5.2 } });
  assert.deepEqual(eq, { type: 'earthquake', id: 'us7000abcd' });

  // Trench
  const tr = State.getFeatureIdentity('trenches', { properties: { Name: 'Mariana', Generic: 'Trench' } });
  assert.deepEqual(tr, { type: 'trench', id: 'mariana' });

  // Fault
  const fl = State.getFeatureIdentity('faults', { properties: { catalog_id: 'UCF_2', name: 'Mount Diablo' } });
  assert.deepEqual(fl, { type: 'fault', id: 'UCF_2' });

  // Plate boundary step
  const pb = State.getFeatureIdentity('plates', { properties: { SEQNUM: 42, Plate_Pair: 'AF-AN', Boundary_Code: 'OTF' } });
  assert.deepEqual(pb, { type: 'boundary', id: '42' });
});

test('State: serializeUrlState and parseUrlState roundtrip', () => {
  const state = {
    selectedFeature: { type: 'volcano', id: '332010' },
    camera: { center: [-155.287, 19.421], zoom: 8.5 },
    projection: 'globe',
    basemap: 'positron',
    earthquakeRange: 'week'
  };

  const urlQuery = State.serializeUrlState(state);
  assert.ok(urlQuery.includes('v=volcano%3A332010') || urlQuery.includes('v=volcano:332010'));
  assert.ok(urlQuery.includes('proj=globe'));
  assert.ok(urlQuery.includes('base=positron'));
  assert.ok(urlQuery.includes('range=week'));
  assert.ok(urlQuery.includes('c=19.421%2C-155.287%2C8.5') || urlQuery.includes('c=19.421,-155.287,8.5'));

  const parsed = State.parseUrlState(urlQuery);
  assert.deepEqual(parsed.selectedFeature, { type: 'volcano', id: '332010' });
  assert.equal(parsed.projection, 'globe');
  assert.equal(parsed.basemap, 'positron');
  assert.equal(parsed.earthquakeRange, 'week');
  assert.ok(Math.abs(parsed.camera.center[0] - (-155.287)) < 0.001);
  assert.ok(Math.abs(parsed.camera.center[1] - 19.421) < 0.001);
  assert.ok(Math.abs(parsed.camera.zoom - 8.5) < 0.001);
});
