# Family Todo — moved

This app now lives at **https://johnson-family-webapps.vercel.app/todo**, part of the
[johnson-family-webapps](https://github.com/tdj182/johnson-family-webapps) monorepo, backed by
Supabase instead of Google Sheets / Apps Script.

`index.html` here just redirects there now, so the old GitHub Pages link and any home-screen
bookmarks keep working.

## What's still here, for reference

- `app.js` / `api.js` / `styles.css` — the original Sheets-backed web app (Phase 1 of
  `docs/family-todo-app-spec.md`). No longer live, kept for history.
- `apps-script/Code.gs` — the Apps Script backend it talked to. Still deployed and functional,
  just unused now.
- `scriptable/FamilyTodo.js` — **still in active use.** This one was ported in place to call
  Supabase's REST API directly (anon key, same no-login trust model as before) instead of the
  Apps Script endpoint — re-copy it into the Scriptable app on your phone to pick up the change.
