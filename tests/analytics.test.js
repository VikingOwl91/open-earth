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
  assert.deepEqual(call[1], Analytics.CONFIG);
  assert.equal(env.appended.length, 1);
  assert.equal(env.appended[0].src, Analytics.SCRIPT_URL);
});
