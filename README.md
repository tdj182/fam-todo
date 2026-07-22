# Family Todo — moved

This app now lives entirely in the
[johnson-family-webapps](https://github.com/tdj182/johnson-family-webapps) monorepo, backed by
Supabase instead of Google Sheets / Apps Script:

- Web app: **https://johnson-family-webapps.vercel.app/todo**
- Scriptable widget source: `apps/hub/scriptable/FamilyTodo.js` in that repo (moved from here —
  everything for this app lives in one place now, per the monorepo's own principle of not
  splitting one app across repos).

`index.html` here just redirects to the web app, so the old GitHub Pages link and any home-screen
bookmarks keep working.

## What's still here, for reference

- `app.js` / `api.js` / `styles.css` — the original Sheets-backed web app (Phase 1 of
  `docs/family-todo-app-spec.md`). No longer live, kept for history.
- `apps-script/Code.gs` — the Apps Script backend it talked to. Still deployed and functional,
  just unused now.
