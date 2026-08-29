<div align="center">

  <a href="https://github.com/NousResearch/hermes-agent">
    <img src="https://github.com/user-attachments/assets/ac2f5702-c842-4b2e-9340-737481fa0ece" width="96" height="96" alt="Nous Research Hermes mark" />
  </a>

  # Hermes RSS

  **Your feeds are a timeline. Your attention isn’t.**

  Hermes RSS turns one noisy stream into a calm reading room for the stories you mean to understand.
  Keep your reading library local, then bring in Hermes when a story deserves a summary, a conversation, or a source check.

  <sub>POWERED BY <a href="https://github.com/NousResearch/hermes-agent">HERMES AGENT</a> &nbsp;·&nbsp; COMMUNITY PLUGIN &nbsp;·&nbsp; VERSION 0.0.1</sub>

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

The reader stays quiet until you ask it to do more. AI actions are explicit and use your configured Hermes providers.

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

## AI, when you ask

Summaries, discussions, and source checks use your configured Hermes model and search providers. Article text is sent for those actions only; once fetched, normal feed reading stays local. Supporting passages are validated against the fetched article before they are shown.

Source checks are conversations with evidence, not automatic truth scores. Model and search providers may apply their normal usage costs.

## Privacy you can explain in one breath

```text
Your Hermes Desktop  →  local RSS library  →  your configured AI provider (only when asked)
```

Your subscriptions, articles, read state, saved stories, and summaries live in the local IndexedDB database `hermes-rss-library`. The data survives Hermes quits, is isolated by Hermes connection and profile, and is not synced by this plugin.

- **Local reading.** Feed text is displayed without active HTML or remote images.
- **Bounded AI context.** Summaries and chats receive the selected article context only when you start that action.
- **Safer fetching.** Feed URLs and redirects are checked before downloading; private network addresses and embedded credentials are rejected.
- **Clean removal.** Removing the plugin file does not erase your local library or Hermes chats.

## Compatibility

Hermes RSS uses the desktop plugin SDK and the standard Hermes gateway methods. Feed refreshes run on the connected gateway with host-native tools: `curl`, gzip, and a DNS lookup on macOS and Linux (`dig` or `getent`), and `curl.exe` plus PowerShell on Windows.

It is tested on macOS with Hermes Desktop. Windows and Linux use the same fetch flow and the same private-network checks.

## Limits

- Up to 200 subscribed feeds.
- The first 100 entries are considered on each refresh.
- Up to 16,000 characters are kept per article.
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
