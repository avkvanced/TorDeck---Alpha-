# TorDeck Public Alpha

This repository contains the **public alpha build** of TorDeck, a cross-platform companion app for managing TorBox downloads across mobile and web.

## What this public version includes

- **Account connection** via TorBox API token, with on-device token storage.
- **Unified library view** that combines torrent, usenet, and web downloads.
- **Media classification** into categories such as video, music, audiobooks, ebooks, and games.
- **Downloads workspace** with filtering, sorting, and per-item actions.
- **Bulk actions** for selected downloads.
- **Add content flow** for magnet links, info hashes, web URLs, and NZB links.
- **Automation rules** for scheduled actions (pause/resume/delete/link requests/notifications).
- **Notification center** for remote and local app events.
- **Statistics dashboard** with usage and category/source breakdowns.
- **Settings panel** for account details, preferences, and session controls.
- **Audiobook-focused screens** with grouped track navigation.
- **Web API proxy support** through Netlify edge functions.

## Public release boundaries

- The transcode backend integration is intentionally excluded from the public alpha.
- The app ships with a stubbed transcode interface that returns a clear "Not included in public release" error.
- No internal infrastructure, private model runtime, or proprietary backend pipeline is bundled in this repository.

## Notes

- This README is intentionally focused on product scope and feature coverage for reviewers.
