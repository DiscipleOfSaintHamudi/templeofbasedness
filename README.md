# @itneverbegunn edits archive — final patch v6

This build includes:

- GoatCounter pageview tracking with a custom JSON-rendered view count (no embedded iframe UI).
- IntenseDebate with stable per-edit IDs/URLs and aggressive guest email/website-field cleanup.
- Firebase-backed community reactions with no pre-rendered zeroes.
- `+` opens a full Unicode emoji picker. The picker is loaded on demand from jsDelivr with an unpkg fallback; if both CDNs fail, visitors can paste any Unicode emoji manually.
- Reaction counts refresh automatically while the page is open.
- The configured Firebase database is `https://sainthamudi-default-rtdb.firebaseio.com/`.

## Firebase rule requirement

Because the site has no user accounts, the reactions endpoint must allow public reads and writes. In Firebase Realtime Database > Rules, a simple casual-site setup is:

```json
{
  "rules": {
    "reactions": {
      ".read": true,
      ".write": true
    }
  }
}
```

This is deliberately permissive: anyone can modify reaction data if they call the database directly. That matches a casual public reaction counter, but it is not appropriate for trusted voting.

## Adding another edit

Upload `media/myedit.mp4`, then add this to `edits.json`:

```json
{
  "id": "myedit",
  "title": "My edit"
}
```

No new HTML page is needed.
