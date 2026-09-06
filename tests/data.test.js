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
