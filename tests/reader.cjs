const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const { gzipSync } = require('node:zlib');
const load = require('./load-plugin.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
const json = value => JSON.parse(JSON.stringify(value));

for (const file of ['plugin.js', 'catalog/desktop/plugin.js']) {
  const setup = () => {
    const dom = new JSDOM('');
    return load(file, { document: dom.window.document, DOMParser: dom.window.DOMParser });
  };
  test(`${file}: existing plugin and storage identities survive the upgrade`, () => {
    const api = setup(), owner = '["local","work"]';
    assert.equal(api.plugin_default.id, 'hermes-rss');
    assert.equal(api.libraryStoreKey(owner), owner);
    const ctx = { storage: { get: (key, fallback) => key === `settings:${owner}` ? { autoRefresh: true, refreshMinutes: 30 } : fallback } };
    assert.equal(api.readSettings(ctx, owner).refreshMinutes, 30);
    assert.equal(api.readSettings(ctx, owner).fullCapture, false);
    assert.equal(api.readSettings(ctx, owner).aiGrading, false);
    assert.equal(api.readSettings(ctx, owner).loadImages, false);
    assert.match(api.gradingSkillCommand('windows', 'rss-importance-grading', 'read'), /\$env:USERPROFILE/);
  });
  test(`${file}: safe rich content retains tables, deduplicates images, and honors image opt-in`, () => {
    const api = setup();
    const raw = '<p onclick="bad()">Article <a href="javascript:bad()">bad link</a></p><script>bad()</script><iframe src="https://evil.example"></iframe><img src="https://example.com/image.jpg" onerror="bad()"><table><tr><th>A</th></tr><tr><td>B</td></tr></table>';
    const off = api.bodyToRichHtml(raw, 'https://example.com/image.jpg', false).html;
    assert.doesNotMatch(off, /<img|<script|<iframe|onclick|onerror|javascript:/i);
    assert.match(off, /<table>/);
    const on = api.bodyToRichHtml(raw, 'https://example.com/image.jpg', true).html;
    assert.equal((on.match(/<img /g) || []).length, 1);
    assert.doesNotMatch(on, /onclick|onerror|javascript:/i);
    assert.doesNotMatch(api.bodyToRichHtml('![x](http://127.0.0.1/private)', '', true).html, /<img/i);
    assert.doesNotMatch(api.bodyToRichHtml('![x](https://example.com/image.jpg)', '', false).html, /<img/i);
  });

  function transport(responses) {
    const api = setup(), commands = [], urls = [];
    const host = { state: { profile: { get: () => 'work' }, connectionId: { get: () => 'local' } },
      profileRoutes: async () => [{ profile: 'work', connectionId: 'local' }],
      requestProfile: async (_route, _method, { command }) => {
        commands.push(command);
        if (command === 'echo %OS%') return { code: 0, stdout: '%OS%' };
        if (command.startsWith('mktemp')) return { code: 0, stdout: '/tmp/hermes-rss.ABCDEFGH' };
        if (command.startsWith('curl ')) {
          const url = /--url '([^']+)'/.exec(command)[1]; urls.push(url);
          return { code: 0, stdout: responses(url) };
        }
        return { code: 0, stdout: '' };
      } };
    api.resolvePublicIPv4 = async (_run, _family, hostname) => {
      if (hostname === 'private.example') throw new Error('Private address');
      return ['93.184.216.34'];
    };
    api.readPackedFeed = async () => gzipSync('<article><p>' + 'Readable article text. '.repeat(20) + '</p></article>').toString('base64');
    return { api, host, commands, urls };
  }
  test(`${file}: capture validates each redirect and rejects private destinations`, async () => {
    const h = transport(() => '302 0 https://private.example/article');
    await assert.rejects(h.api.captureArticle(h.host, 'https://example.com/article'), /Private/);
    assert.equal(h.urls.length, 1);
    assert.ok(h.commands.every(command => !command.includes('--location')));
  });
  test(`${file}: capture follows public redirects and concurrent jobs use different files`, async () => {
    const h = transport(url => url.endsWith('/redirect') ? '302 0 https://other.example/article' : '200 600 ');
    await Promise.all([h.api.captureArticle(h.host, 'https://example.com/redirect'), h.api.captureArticle(h.host, 'https://example.com/second')]);
    assert.ok(h.urls.includes('https://other.example/article'));
    const files = h.commands.filter(command => command.startsWith('curl ')).map(command => /--output '([^']+)'/.exec(command)[1]);
    assert.equal(new Set(files).size, 2);
  });

  // A 0.22 gateway requires params.session_id; the older sidecar refuses it.
  function gateway(mode, session) {
    const h = transport(() => '200 600 '), sent = [];
    const request = h.host.requestProfile;
    let current = session;
    h.host.state.focusedSessionId = { get: () => current };
    h.host.requestProfile = async (route, method, params) => {
      sent.push(Object.keys(params).sort().join(','));
      if (mode() === 'scoped' && !params.session_id) throw new Error('invalid_params');
      if (mode() === 'sidecar' && 'session_id' in params) throw new Error('invalid params for shell.exec: session_id: Extra inputs are not permitted');
      return request(route, method, params);
    };
    return { ...h, sent, switchTo: id => { current = id; } };
  }
  test(`${file}: shell.exec sends the focused session to a session-scoped gateway`, async () => {
    const g = gateway(() => 'scoped', 'session-a');
    await g.api.captureArticle(g.host, 'https://example.com/article');
    assert.ok(g.sent.length > 1);
    assert.ok(g.sent.every(keys => keys === 'command,session_id'));
    g.switchTo('');
    await assert.rejects(g.api.captureArticle(g.host, 'https://example.com/other'), /Open a chat/);
  });
  test(`${file}: shell.exec falls back to bare params once on a sidecar gateway`, async () => {
    let mode = 'sidecar';
    const g = gateway(() => mode, 'session-a');
    await g.api.captureArticle(g.host, 'https://example.com/article');
    assert.deepEqual(g.sent.slice(0, 2), ['command,session_id', 'command']);
    assert.ok(g.sent.slice(2).every(keys => keys === 'command'), 'the refusal is remembered for the profile');
    mode = 'scoped';
    g.sent.length = 0;
    await g.api.captureArticle(g.host, 'https://example.com/second');
    assert.deepEqual(g.sent.slice(0, 2), ['command', 'command,session_id'], 'an upgraded gateway gets the session again');
  });

  test(`${file}: captured content survives refresh/reopen but never crosses a changed URL`, async () => {
    const api = setup();
    let state = { feeds: [{ id: 'feed' }], articles: [{ id: 'a', identity: 'a', feed_id: 'feed', title: 'Old', url: 'https://example.com/a', body: 'excerpt', actions: [], is_saved: true }] };
    const transaction = async (_owner, mutate) => { const next = structuredClone(state); const result = mutate ? mutate(next) : next; if (mutate) state = next; return result; };
    const request = api.createLibrary('work', null, transaction);
    await request('/articles/a/capture', { method: 'POST', body: { url: 'https://example.com/a', body: 'Full article' } });
    api.mergeFeed(state, 'feed', { title: 'Feed', items: [{ identity: 'a', title: 'Old', url: 'https://example.com/a', body: 'new excerpt' }] });
    assert.equal((await api.createLibrary('work', null, transaction)('/articles/a')).body, 'Full article');
    api.mergeFeed(state, 'feed', { title: 'Feed', items: [{ identity: 'a', title: 'New', url: 'https://example.com/b', body: 'different article' }] });
    assert.equal(state.articles[0].body, 'different article');
    assert.equal(state.articles[0].captured, false);
    await assert.rejects(request('/articles/a/capture', { method: 'POST', body: { url: 'https://example.com/a', body: 'stale capture' } }), /URL changed/);
  });

  test(`${file}: grading rejects an owner switch before any model call`, async () => {
    const api = setup(); let calls = 0;
    const host = { state: { profile: { get: () => 'other' }, connectionId: { get: () => 'local' } },
      profileRoutes: async () => [{ profile: 'other', connectionId: 'local' }],
      requestProfile: async () => { calls++; return { text: '{"grades":[]}' }; } };
    api.readGradingSkill = async () => '';
    await assert.rejects(api.gradingPass(host, async () => [{ id: 'a', title: 'Private article' }], { owner: '["local","work"]' }), /profile|Profile/);
    assert.equal(calls, 0);
  });
  test(`${file}: grading filters before pagination so older ungraded articles remain reachable`, async () => {
    const api = setup();
    const articles = Array.from({ length: 301 }, (_, i) => ({ id: String(i), title: 'Article', body: 'body', published_at: new Date(1700000000000 - i * 1000).toISOString(), grade: i < 300 ? { level: 'normal' } : undefined }));
    const library = api.createLibrary('work', null, async (_owner, mutate) => mutate ? mutate({ feeds: [], articles }) : { feeds: [], articles });
    let sent;
    api.readGradingSkill = async () => '';
    api.publishLibraryChange = () => {};
    const host = { state: { profile: { get: () => 'work' }, connectionId: { get: () => 'local' } },
      profileRoutes: async () => [{ profile: 'work', connectionId: 'local' }],
      requestProfile: async (_route, _method, payload) => { sent = JSON.parse(payload.input); return { text: '{"grades":[{"id":"300","level":"normal"}]}' }; } };
    await api.gradingPass(host, library, { owner: '["local","work"]' });
    assert.equal(sent[0].id, '300');
    assert.equal(articles[300].grade.level, 'normal');
  });

  test(`${file}: automatic grading stops after opt-out during a model request`, async () => {
    const api = setup(), owner = '["local","work"]';
    let enabled = true, writes = 0;
    const ctx = { storage: { get: (_key, fallback) => ({ aiGrading: enabled }), set() {} } };
    api.readGradingSkill = async () => '';
    const library = async (_path, options) => { if (options) writes++; return [{ id: 'a', title: 'Article' }]; };
    const host = { state: { profile: { get: () => 'work' }, connectionId: { get: () => 'local' } },
      profileRoutes: async () => [{ profile: 'work', connectionId: 'local' }],
      requestProfile: async () => { enabled = false; return { text: '{"grades":[{"id":"a","level":"normal"}]}' }; } };
    await assert.rejects(api.gradingPass(host, library, { owner, ctx }), /off/);
    assert.equal(writes, 0);
  });

  test(`${file}: RSS 1.0 (RDF) feeds list sibling items with the channel title`, () => {
    const api = setup();
    const xml = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel rdf:about="https://journal.example/rss"><title>Journal &amp; Letters</title><link>https://journal.example/</link>
    <items><rdf:Seq><rdf:li rdf:resource="https://journal.example/a/1"/></rdf:Seq></items></channel>
  <item rdf:about="https://journal.example/a/1"><title>First paper</title><link>https://journal.example/a/1</link>
    <description>Abstract one</description><dc:date>2026-10-19T08:00:00Z</dc:date></item>
  <item rdf:about="https://journal.example/a/2"><title>Second paper</title><link>/a/2</link>
    <content:encoded><![CDATA[<p>Full text two</p>]]></content:encoded></item>
</rdf:RDF>`;
    const feed = json(api.parseFeed(xml, 'https://journal.example/rss'));
    assert.equal(feed.title, 'Journal & Letters');
    assert.deepEqual(feed.items.map(item => item.title), ['First paper', 'Second paper']);
    assert.deepEqual(feed.items.map(item => item.url), ['https://journal.example/a/1', 'https://journal.example/a/2']);
    assert.equal(feed.items[0].published_at, '2026-10-19T08:00:00.000Z');
    assert.match(feed.items[1].body, /Full text two/);
    assert.throws(() => api.parseFeed('<html><body/></html>', 'https://journal.example/'), /RSS or Atom/);
  });

  test(`${file}: quoted markup in article bodies is not a DTD`, () => {
    const api = setup();
    const item = '<item><title>HTML snippet</title><link>https://blog.example/a</link>'
      + '<content:encoded><![CDATA[<pre>&lt;!DOCTYPE html&gt;</pre><!DOCTYPE html><!ENTITY x "y">]]></content:encoded></item>';
    const rss = `<?xml version="1.0"?>\n<!-- feed --><rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Blog</title>${item}</channel></rss>`;
    const feed = json(api.parseFeed(rss, 'https://blog.example/feed'));
    assert.deepEqual(feed.items.map(entry => entry.title), ['HTML snippet']);
    assert.match(feed.items[0].body, /DOCTYPE html/);
    const dtd = '<!DOCTYPE rss [<!ENTITY a "aaaa">]>';
    for (const xml of [
      `${dtd}<rss><channel><title>&a;</title></channel></rss>`,
      `\uFEFF<?xml version="1.0"?>\n<?xml-stylesheet href="s.xsl"?>\n<!-- <rss> -->\n${dtd}<rss/>`,
      '<!ENTITY a "aaaa"><rss/>',
      '<!doctype rss><rss/>'
    ]) assert.throws(() => api.parseFeed(xml, 'https://blog.example/feed'), /Unsafe/, xml);
    const opml = '<?xml version="1.0"?><opml version="2.0"><head><title>Feeds</title></head><body>'
      + '<!-- exported from <!DOCTYPE html> pages --><outline text="Blog" xmlUrl="https://blog.example/feed"/></body></opml>';
    assert.deepEqual(json(api.parseOpml(opml)).map(entry => entry.url), ['https://blog.example/feed']);
    assert.throws(() => api.parseOpml('<!DOCTYPE opml [<!ENTITY a "a">]><opml/>'), /Unsafe/);
  });

  test(`${file}: packed downloads survive grouped transport and reject redacted payloads`, async () => {
    const api = setup(), xml = '<rss><channel><title>T</title></channel></rss>';
    const b64 = gzipSync(xml).toString('base64');
    const grouped = b64.replace(/(.{4})/g, '$1 ');
    assert.equal(Buffer.from(api.decodePacked(grouped)).toString('base64'), b64);
    assert.throws(() => api.decodePacked(b64.slice(0, 8) + '...' + b64.slice(48)), /damaged download/);
    assert.throws(() => api.decodePacked(b64.slice(1)), /damaged download/);
    const commands = [];
    const long = 'A'.repeat(6000);
    const posix = async command => {
      commands.push(command);
      if (command.endsWith('| wc -c')) return String(long.length);
      const [, from, to] = /cut -c (\d+)-(\d+)/.exec(command);
      return long.slice(from - 1, to).replace(/(.{4})/g, '$1 ').trim();
    };
    const packed = await api.readPackedFeed(posix, 'posix', '/tmp/hermes-rss.ABCDEFGH', '/tmp/hermes-rss.ABCDEFGH/feed');
    assert.ok(commands.slice(1).every(command => command.endsWith("| sed 's/..../& /g'")));
    assert.ok(packed.split(/\s+/).every(group => group.length <= 4), 'no run longer than four characters crosses a chunk');
    assert.equal(packed.replace(/\s+/g, ''), long);
    const windows = [];
    await api.readPackedFeed(async command => { windows.push(command); return command.endsWith('.Length"') ? '4' : 'AAAA'; },
      'windows', 'C:\Temp\hermes-rss.ABCDEFGH', 'C:\Temp\hermes-rss.ABCDEFGH\feed');
    assert.ok(windows.some(command => command.includes("-replace '(.{4})','$1 '")));
  });

  test(`${file}: Windows compressed capture files belong to each download`, async () => {
    const api = setup(), commands = [];
    const run = async command => { commands.push(command); return command.endsWith('.Length"') ? '4' : 'AAAA'; };
    await api.readPackedFeed(run, 'windows', 'C:\\Temp\\hermes-rss.ABCDEFGH', 'C:\\Temp\\hermes-rss.ABCDEFGH\\page-one');
    assert.ok(commands.every(command => !command.includes('\\feed.gz') && !command.includes('\\feed.b64')));
    assert.ok(commands.some(command => command.includes('page-one.gz')));
    assert.ok(commands.some(command => command.includes('page-one.b64')));
  });

  test(`${file}: capture queue is bounded, resumes persisted jobs and honors opt-out`, async () => {
    const timers = [], api = setup(), values = new Map();
    api.setInterval = fn => { timers.push(fn); return fn; }; api.clearInterval = () => {};
    const owner = '["local","work"]';
    const ctx = { storage: { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, structuredClone(value)) } };
    const host = { state: { profile: { get: () => 'work' }, connectionId: { get: () => 'local' } } };
    let started = 0, active = 0, peak = 0;
    const complete = [];
    api.createLibrary = () => async path => path.endsWith('/capture') ? undefined : { url: `https://example.com/${path.split('/').pop()}`, body: '' };
    api.captureArticle = async () => { started++; active++; peak = Math.max(peak, active); await new Promise(resolve => complete.push(resolve)); active--; return { body: 'captured' }; };
    api.publishLibraryChange = () => {};
    let stop = api.startCaptureWorker(ctx, host);
    api.captureEnqueue(owner, Array.from({ length: 90 }, (_, i) => ({ id: String(i), url: `https://example.com/${i}` })));
    await flush(); assert.equal(started, 0);
    assert.equal(api.storageGet(ctx, 'captureQueue', owner, []).length, 80);
    stop(); api.storageSet(ctx, 'settings', owner, { fullCapture: true });
    stop = api.startCaptureWorker(ctx, host); await flush();
    assert.equal(started, 2); assert.equal(peak, 2);
    api.storageSet(ctx, 'settings', owner, { fullCapture: false });
    complete.splice(0).forEach(resolve => resolve()); await flush();
    assert.equal(started, 2); assert.equal(api.storageGet(ctx, 'captureQueue', owner, []).length, 80);
    stop();
  });
}
