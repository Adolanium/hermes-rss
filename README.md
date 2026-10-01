<div align="center">

  <a href="https://github.com/NousResearch/hermes-agent">
    <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Nous Research Hermes mark" />
  </a>

  # Hermes RSS

  **Your feeds are a timeline. Your attention isn’t.**

  Hermes RSS turns one noisy stream into a calm reading room for the stories you mean to understand.
  Keep your reading library local, then bring in Hermes when a story deserves a summary, a conversation, or a source check.

  <sub>POWERED BY <a href="https://github.com/NousResearch/hermes-agent">HERMES AGENT</a> &nbsp;·&nbsp; COMMUNITY PLUGIN &nbsp;·&nbsp; VERSION 0.0.2</sub>

  <br /><br />

  [Explore the product](#rss-with-an-agent-in-the-room) &nbsp;·&nbsp; [Install it](#make-it-yours) &nbsp;·&nbsp; [Understand the data](#privacy-you-can-explain-in-one-breath)

</div>

<img width="1470" height="770" alt="hermes-rss-reader" src="https://github.com/user-attachments/assets/dd454b2a-e504-4cb0-a886-15cd2b173e53" />

## Powered by Hermes

Hermes RSS is a community-built reading surface for [Hermes Desktop](https://github.com/NousResearch/hermes-agent). It uses the Hermes plugin SDK, your configured model and search providers, native Hermes conversations, and the same profile-aware desktop environment you already use.

The feed reader gives Hermes a focused starting point. A headline becomes a summary, a discussion, or a source investigation without leaving the app.


## RSS with an agent in the room

Most feed readers stop at a list of headlines. Hermes RSS gives each story a next step without turning every article into an AI task.

| | |
| --- | --- |
| **Read**<br />Subscribe to RSS 2.0 and Atom feeds, search your library, and open the original article. | **Remember**<br />Save the stories worth keeping, mark one feed or everything as read, and return to them across Hermes restarts. |
| **Understand**<br />Ask for a concise summary with supporting passages from the fetched article. | **Investigate**<br />Open a native Hermes chat to discuss a story or find more sources for a claim. |

Summaries and source checks run when requested. Optional automatic grading sends article excerpts to your configured Hermes model after refresh; it is off by default.

## Less feed maintenance. More finishing.

Hermes RSS handles the small decisions that make a reader pleasant to return to:

- Opening an article marks it read when that setting is enabled.
- Read stories fade into the background while unread stories stay easy to spot.
- Unsubscribe from a feed without losing stories you explicitly saved.
- Refresh automatically every 1 to 1,440 minutes while Hermes is open, or refresh on demand.
- Dismiss status notices after 10 seconds, or immediately with **×**.
- Import and export OPML from Settings when you want to move a collection of feeds. The empty library also offers import.

The result is a library that gets quieter as you use it.

## Built for real feeds, not a demo list

Hermes RSS is a single desktop plugin with its own **RSS** category in Hermes. It supports RSS 2.0 and Atom feeds, keeps article history locally, and works with stock Hermes Desktop. There is no fork, upstream patch, separate backend, build step, or package manager.

## Make it yours

### Install

Copy [`plugin.js`](plugin.js) to Hermes’ desktop plugin directory:

```text
~/.hermes/desktop-plugins/hermes-rss/plugin.js
```

On Windows:

```text
%USERPROFILE%\.hermes\desktop-plugins\hermes-rss\plugin.js
```

Open Hermes and choose **RSS** in the sidebar. If it is missing, use **Cmd+K** (**Ctrl+K** on Windows) → **Reload desktop plugins**. Restart Hermes after replacing the file if an already-open reader keeps the old plugin loaded.

Add a feed URL and start reading. The same `plugin.js` file is both the source and the installable artifact.

## Search and mute rules

The reader has a subscription sidebar, article list, and reading pane. Use **j** and
**k** to move between articles, and subscription edit mode to reorder feeds and
folders. Keyboard shortcuts pause while you type in a field.

Use **Filters** to exclude a phrase, save the current search, or add mute rules for all feeds or one subscription. Matching uses literal phrases in titles and feed text and ignores case.

Saved searches appear in the sidebar and remember the search phrase, exclusion, feed, reading view, and **Show hidden** choice. Searches and rules are stored with the local library for the current connection and profile.

Mute rules hide matching articles before pagination. They do not delete articles or change read and saved state. **Show hidden articles** temporarily bypasses mute rules; explicit search and exclusion filters still apply. Unread totals include hidden articles, and **Mark all as read** still applies to the whole library or selected feed.

Click a filter chip to clear it, or use **Reset filters** to return to All articles. Resetting the view keeps your saved searches and mute rules. Remove individual searches or rules from **Filters**.

## AI, when you ask

Summaries, discussions, and source checks use your configured Hermes model and search providers. Supporting passages are validated against the fetched article before they are shown.

Settings also offers optional **AI grading**, off by default. Each run sends up to
three batches of 60 ungraded article excerpts to your configured model and stores
the resulting labels locally. **Grade** runs it manually. The preference skill
controls the rubric, labels, and colors. Automatic grading stops sending new
requests when disabled or when you switch profiles; requests already sent may
still finish.

## Full articles and images

Use **Load full article** to capture readable text from the original page. Enable
background capture in Settings to queue articles after refresh. Two workers
process a persistent queue of up to 80 articles without delaying feed refresh.
Captured bodies survive refresh and restart while their articles remain in the
library. Capture uses the original page and does not bypass paywalls.

The reader supports sanitized HTML, Markdown, and tables. **Load article images**
is off by default and controls both thumbnails and images in the reading pane.
When enabled, images load directly from publishers in Desktop and may reveal your
IP address. Duplicate lead images are suppressed.

Source checks are conversations with evidence, not automatic truth scores. Model and search providers may apply their normal usage costs.

## Privacy you can explain in one breath

```text
Your Hermes Desktop  →  local RSS library  →  your configured AI provider (only when asked)
```

Your subscriptions, articles, read state, saved stories, and summaries live in the local IndexedDB database `hermes-rss-library`. The data survives Hermes quits, is isolated by Hermes connection and profile, and is not synced by this plugin.

- **Local reading.** Feed content is sanitized; scripts and embedded active content are removed. Remote images require a separate opt-in.
- **Bounded AI context.** Summaries and chats receive selected article context when requested. Optional automatic grading sends bounded batches of excerpts after refresh.
- **Safer fetching.** Feed URLs and redirects are checked before downloading; private network addresses and embedded credentials are rejected.
- **Clean removal.** Removing the plugin file does not erase your local library or Hermes chats.

## Compatibility

Hermes RSS uses the desktop plugin SDK and the standard Hermes gateway methods. Feed refreshes run on the connected gateway with host-native tools: `curl`, gzip, and a DNS lookup on macOS and Linux (`dig` or `getent`), and `curl.exe` plus PowerShell on Windows.

It is tested on macOS with Hermes Desktop. Windows and Linux use the same fetch flow and the same private-network checks.

## Limits

- Up to 200 subscribed feeds.
- The first 100 entries are considered on each refresh.
- Plain feed bodies retain up to 16,000 characters, rich feed bodies up to 24,000, and captured articles up to 60,000.
- Unsaved history is capped at 300 articles per feed; saved stories are retained.

An RSS feed can provide an excerpt instead of the full article. Unsubscribing removes unsaved stories from that feed but keeps saved stories and existing Hermes chats.

<br />

<div align="center">
  <strong>Hermes RSS</strong><br />
  <sub>A calmer place for the stories that matter.</sub>
</div>

<br />

> **Community project**
>
> Hermes RSS is an independent community plugin. It is not affiliated with, endorsed by, sponsored by, or officially associated with [Nous Research](https://github.com/NousResearch) or the [Hermes Agent project](https://github.com/NousResearch/hermes-agent). Hermes, Hermes Agent, and Nous Research are names and marks belonging to their respective owners.

## Development checks

Run `npm ci --ignore-scripts` and `npm test` for filter, capture, rendering, queue,
and profile-isolation checks against the source and catalog distributions.
Run `node benchmarks/library.cjs` for library benchmarks. The test dependencies
are for development only; installing the plugin requires no npm packages.


## Catalog package

The `catalog/` directory packages this Desktop plugin for the Hermes plugin catalog,
using the [combined package layout](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk#one-package-both-sdks).
Catalog admission is pending. The repository does not imply approval or endorsement.

To install the package directly before catalog admission:

```sh
hermes plugins install Adolanium/hermes-rss/catalog
```

Restart Hermes Desktop or rescan plugins, then enable the Desktop component in
Capabilities > Plugins. This package adds no Agent tools, hooks, or middleware.
It requires Hermes Desktop with combined-package support. On a remote backend,
the Desktop component must also be installed on the machine running the app.

The existing root `plugin.js` remains the standalone distribution. Keep one
installation per Desktop plugin. Before switching from a manual install, back up
and move its folder out of the Desktop plugin directory; Hermes intentionally
does not overwrite manual installations. Keep plugin settings when migrating.

After catalog admission, use `hermes plugins update hermes-rss` and rescan
Desktop plugins to adopt a reviewed update. The packaged copy's update and restore
actions cannot replace its files from GitHub releases. Standalone signed updates
continue to use the existing root files.

For development, edit the root files, then run `python scripts/build_catalog.py`.
Commit the resulting `catalog/` files. CI runs `python scripts/build_catalog.py --check`
to keep the package current, including any companion files. Catalog packaging
releases use `catalog-v0.0.3` and are not marked as the latest standalone release.

## Contributions

Thanks to [@apoapostolov](https://github.com/apoapostolov) for the reader layout,
keyboard navigation, article capture, rich rendering, media support, background
queue, and filtering and grading enhancements in
[PRs #4–#9](https://github.com/Adolanium/hermes-rss/pull/9). The integration retains
the original contributor commits and adds compatibility fixes and regression tests.
