import test from 'node:test';
import assert from 'node:assert/strict';
import Analytics from '../src/analytics.js';

function fakeEnv(location) {
  const appended = [];
  const win = { location };
  const doc = {
    head: { appendChild: (el) => appended.push(el) },
    createElement: (tag) => ({ tag })
  };
  return { win, doc, appended };
}

test('Analytics: config matches the documented, cookieless setup', () => {
  assert.deepEqual(Analytics.CONFIG, {
    apiUrl: 'https://op.nachtigall.dev/api',
    clientId: '75cb34b1-c4d2-4299-a93f-f5563fbaf40c',
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true
  });
  assert.equal('sessionReplay' in Analytics.CONFIG, false);
});

test('Analytics: tracker script is served from the same origin', () => {
  assert.match(Analytics.SCRIPT_URL, /^\.\/vendor\/openpanel\/op1\.js$/);
});

test('Analytics: local contexts are never tracked', () => {
  for (const loc of [
    { protocol: 'http:', hostname: 'localhost' },
    { protocol: 'http:', hostname: 'dev.localhost' },
    { protocol: 'http:', hostname: '127.0.0.1' },
    { protocol: 'http:', hostname: '[::1]' },
    { protocol: 'file:', hostname: '' },
    { protocol: 'http:', hostname: '' }
  ]) {
    assert.equal(Analytics.isLocalContext(loc), true, JSON.stringify(loc));
    const env = fakeEnv(loc);
    assert.equal(Analytics.init(env.win, env.doc), false);
    assert.equal(env.win.op, undefined);
    assert.equal(env.appended.length, 0);
  }
});

test('Analytics: public host queues init and loads the vendored script', () => {
  const env = fakeEnv({ protocol: 'https:', hostname: 'earth.example.org' });
  assert.equal(Analytics.init(env.win, env.doc), true);
  assert.equal(typeof env.win.op, 'function');
  const [call] = env.win.op.q;
  assert.equal(call[0], 'init');
  assert.deepEqual({ ...call[1], filter: undefined }, { ...Analytics.CONFIG, filter: undefined });
  assert.equal(typeof call[1].filter, 'function');
  assert.equal(env.appended.length, 1);
  assert.equal(env.appended[0].src, Analytics.SCRIPT_URL);
});

const view = (qs) => ({
  type: 'track',
  payload: { name: 'screen_view', properties: { __path: `https://earth.example.org/${qs}`, __title: 'Open Earth' } }
});

test('Analytics filter: first screen_view is always sent', () => {
  const filter = Analytics.createScreenViewFilter();
  assert.equal(filter(view('?c=-6.2231%2C105.7915%2C8')), true);
});

test('Analytics filter: camera-only URL changes are dropped', () => {
  const filter = Analytics.createScreenViewFilter();
  assert.equal(filter(view('?c=-6.2231%2C105.7915%2C8')), true);
  assert.equal(filter(view('?c=-6.2231%2C106.4%2C8')), false);
  assert.equal(filter(view('?c=-5.78%2C106.4%2C9')), false);
  assert.equal(filter(view('')), false);
});

test('Analytics filter: changes to other state are sent, compared to the last sent view', () => {
  const filter = Analytics.createScreenViewFilter();
  assert.equal(filter(view('?c=1%2C2%2C3')), true);
  assert.equal(filter(view('?c=4%2C5%2C6')), false);
  assert.equal(filter(view('?v=volcano%3A263010&c=4%2C5%2C6')), true);
  assert.equal(filter(view('?v=volcano%3A263010&c=7%2C8%2C9')), false);
  assert.equal(filter(view('?c=7%2C8%2C9&v=volcano%3A263010')), false);
  assert.equal(filter(view('?v=volcano%3A263010&layers=faults&c=7%2C8%2C9')), true);
  assert.equal(filter(view('?v=volcano%3A263011&layers=faults&c=7%2C8%2C9')), true);
  assert.equal(filter(view('?layers=faults')), true);
});

test('Analytics filter: events other than screen_view pass untouched', () => {
  const filter = Analytics.createScreenViewFilter();
  filter(view('?c=1%2C2%2C3'));
  const linkOut = { type: 'track', payload: { name: 'link_out', properties: { href: 'https://example.com', __path: 'https://earth.example.org/?c=1%2C2%2C3' } } };
  assert.equal(filter(linkOut), true);
  assert.equal(filter(linkOut), true);
  assert.equal(filter({ type: 'identify', payload: {} }), true);
  assert.equal(filter(view('?c=4%2C5%2C6')), false);
});

test('Analytics filter: malformed payloads fail open and do not throw', () => {
  const filter = Analytics.createScreenViewFilter();
  for (const event of [
    undefined,
    null,
    {},
    { type: 'track' },
    { type: 'track', payload: { name: 'screen_view' } },
    { type: 'track', payload: { name: 'screen_view', properties: {} } },
    { type: 'track', payload: { name: 'screen_view', properties: { __path: 'not a url' } } }
  ]) {
    assert.equal(filter(event), true, JSON.stringify(event));
  }
});
