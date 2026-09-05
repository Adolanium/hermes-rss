const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const source = readFileSync(resolve(__dirname, '../plugin.js'), 'utf8');
function setup() {
  const context = vm.createContext({ URL, crypto: { randomUUID } });
  vm.runInContext(source.slice(source.indexOf('var EMPTY ='), source.indexOf('// Reader preferences')), context);
  const state = new Map();
  const initial = () => ({ feeds: [{ id: 'a' }, { id: 'b' }], articles: [
    { id: '1', feed_id: 'a', title: 'COUPON for a telescope', body: 'Mercury research', is_read: false, is_saved: true, published_at: '2026-09-03' },
    { id: '2', feed_id: 'b', title: 'Mercury mission', body: 'A coupon is included', is_read: false, is_saved: false, published_at: '2026-09-02' },
    { id: '3', feed_id: 'a', title: 'Mercury mission', body: 'Science report', is_read: true, is_saved: true, published_at: '2026-09-01' }
  ] });
  const transaction = async (owner, mutate) => {
    const library = structuredClone(state.get(owner) || initial());
    const result = mutate ? mutate(library) : library;
    if (mutate) state.set(owner, library);
    return result;
  };
  return { open: owner => context.createLibrary(owner, null, transaction) };
}
const ids = rows => Array.from(rows, row => row.id);
test('literal inclusion and exclusion combine with feed, saved and unread filters before pagination', async () => {
  const request = setup().open('default');
  assert.deepEqual(ids(await request('/articles?q=MERCURY&exclude=COUPON&limit=1')), ['3']);
  assert.deepEqual(ids(await request('/articles?q=Mercury&view=unread&feed_id=b')), ['2']);
  assert.deepEqual(ids(await request('/articles?view=saved')), ['1', '3']);
  assert.deepEqual(ids(await request('/articles?q=.*')), []);
});
test('mute rules persist, respect feed scope and preserve articles and unread counts', async () => {
  const { open } = setup(), request = open('default');
  const before = JSON.stringify(await request('/feeds'));
  const rule = await request('/filters/mutes', { method: 'POST', body: { phrase: ' coupon ', feed_id: 'a' } });
  assert.deepEqual(ids(await open('default')('/articles?limit=1')), ['2']);
  assert.deepEqual(ids(await request('/articles?show_hidden=true')), ['1', '2', '3']);
  assert.equal(JSON.stringify(await request('/feeds')), before);
  assert.equal((await request('/articles/1')).is_read, false);
  assert.equal((await request('/articles/1')).is_saved, true);
  await request(`/filters/mutes/${rule.id}`, { method: 'DELETE' });
  assert.deepEqual(ids(await request('/articles')), ['1', '2', '3']);
});
test('global mutes apply across views and show-hidden does not bypass explicit exclusion', async () => {
  const request = setup().open('default');
  await request('/filters/mutes', { method: 'POST', body: { phrase: 'coupon' } });
  assert.deepEqual(ids(await request('/articles?view=saved')), ['3']);
  assert.deepEqual(ids(await request('/articles?view=unread')), []);
  assert.deepEqual(ids(await request('/articles?show_hidden=true&exclude=coupon')), ['3']);
});
test('saved searches survive reopening and filters are isolated by owner', async () => {
  const { open } = setup(), request = open('default');
  const search = { name: 'Science', query: 'Mercury', exclude: 'coupon', feed_id: 'a', view: 'saved', show_hidden: true };
  const saved = await request('/filters/searches', { method: 'POST', body: search });
  assert.deepEqual(JSON.parse(JSON.stringify((await open('default')('/filters')).searches[0])), { ...search, id: saved.id });
  assert.equal((await open('remote')('/filters')).searches.length, 0);
  await request('/filters/mutes', { method: 'POST', body: { phrase: 'Mercury' } });
  assert.deepEqual(ids(await open('remote')('/articles')), ['1', '2', '3']);
  await request(`/filters/searches/${saved.id}`, { method: 'DELETE' });
  assert.equal((await request('/filters')).searches.length, 0);
});
test('invalid and duplicate rules are rejected without changing storage', async () => {
  const request = setup().open('default');
  for (const body of [{ phrase: ' ' }, { phrase: 'coupon', feed_id: 'missing' }])
    await assert.rejects(request('/filters/mutes', { method: 'POST', body }));
  await request('/filters/mutes', { method: 'POST', body: { phrase: 'coupon' } });
  await assert.rejects(request('/filters/mutes', { method: 'POST', body: { phrase: 'COUPON' } }), /already exists/);
  assert.equal((await request('/filters')).mutes.length, 1);
});
