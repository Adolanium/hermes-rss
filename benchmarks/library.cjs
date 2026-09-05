// Run: node benchmarks/library.cjs [baseline-plugin.js]
// Timings exclude fixture creation, IndexedDB, network, and React rendering.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

function load(file) {
  const source = fs.readFileSync(file, 'utf8');
  let id = 0;
  const context = vm.createContext({
    URL, crypto: { randomUUID: () => `new-${++id}` },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-05T00:00:00Z'])); } }
  });
  vm.runInContext(source.slice(source.indexOf('var EMPTY ='), source.indexOf('// Reader preferences')), context);
  return context;
}
function fixture(count) {
  const feeds = Array.from({ length: count }, (_, i) => ({ id: `f${i}`, title: `Feed ${i}` }));
  const articles = feeds.flatMap(f => Array.from({ length: 300 }, (_, i) => ({
    id: `${f.id}-${i}`, feed_id: f.id, identity: `item-${i}`, title: `Article ${i}`,
    url: `https://example.com/${i}`, body: 'Feed article text. '.repeat(20),
    is_read: i % 3 === 0, is_saved: i % 10 === 0,
    published_at: new Date(1700000000000 + i * 1000).toISOString(),
    actions: [{ kind: 'summarize', stale: false }]
  })));
  return { feeds, articles };
}
function incoming() {
  return { title: 'Updated feed', items: Array.from({ length: 100 }, (_, i) => ({
    identity: `item-${250 + i}`, title: `Updated ${i}`, body: `Updated body ${i}`,
    url: `https://example.com/${i}`, published_at: '2026-09-05T00:00:00Z'
  })) };
}
const json = value => JSON.parse(JSON.stringify(value));
async function verify(file) {
  const api = load(file), library = fixture(3);
  // First matching identity wins; duplicate incoming entries must not add twice.
  library.articles.push({ ...library.articles[852], id: 'duplicate-existing' });
  library.articles.push({ ...library.articles[0], id: 'saved-orphan', feed_id: 'removed', is_saved: true });
  const request = api.createLibrary('owner', async () => incoming(), async (_, mutate) => mutate ? mutate(library) : library);
  const before = await request('/feeds');
  assert.deepEqual(before.map(f => f.unread).join(','), '200,200,200');
  const parsed = incoming();
  parsed.items.push({ ...parsed.items[99], body: 'Last duplicate wins' });
  const result = api.mergeFeed(library, 'f2', parsed);
  assert.equal(result.added, 50);
  assert.equal(library.articles.find(a => a.identity === 'item-349').body, 'Last duplicate wins');
  assert.equal(library.articles.find(a => a.id === 'f2-250').actions[0].stale, true);
  assert.equal(library.articles.filter(a => a.feed_id === 'f2' && !a.is_saved).length, 300);
  assert(library.articles.some(a => a.id === 'f2-0'));
  assert.equal(library.articles.find(a => a.id === 'duplicate-existing').body, library.articles[0].body);
  assert.throws(() => api.mergeFeed(library, 'missing', parsed), /removed/);
  const outputs = [before, result, await request('/feeds'), await request('/articles?view=saved'), json(library)];
  const singleLibrary = fixture(1);
  singleLibrary.articles.push({ ...singleLibrary.articles[1], feed_id: 'removed' });
  const single = api.createLibrary('single', null, async () => singleLibrary);
  assert.equal((await single('/feeds'))[0].unread, 200);
  const empty = api.createLibrary('empty', null, async () => ({ feeds: [], articles: [] }));
  assert.equal((await empty('/feeds')).length, 0);
  return json(outputs);
}
async function measure(file, count, operation) {
  const api = load(file), samples = [];
  for (let i = 0; i < 35; i++) {
    const library = fixture(count), parsed = incoming();
    const request = api.createLibrary('owner', null, async () => library);
    const start = performance.now();
    if (operation === 'unread counts') await request('/feeds');
    else api.mergeFeed(library, `f${count - 1}`, parsed);
    if (i >= 10) samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}
(async () => {
  const current = path.resolve(__dirname, '../plugin.js');
  const baseline = process.argv[2] && path.resolve(process.argv[2]);
  const result = await verify(current);
  if (baseline) assert.deepEqual(result, await verify(baseline));
  console.log('Behavior checks passed' + (baseline ? '; complete outputs match baseline.' : '.'));
  for (const count of [1, 20, 200]) {
    for (const operation of ['unread counts', 'merge 100 items']) {
      const before = baseline ? await measure(baseline, count, operation) : null;
      const after = await measure(current, count, operation);
      console.log(`${count} feeds / ${count * 300} articles | ${operation} | ` +
        (baseline ? `${before.toFixed(3)} -> ${after.toFixed(3)} ms | ${(before / after).toFixed(2)}x` : `${after.toFixed(3)} ms`));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
