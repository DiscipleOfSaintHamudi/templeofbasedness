# @itneverbegunn edits archive — upgraded build

Build: `20261004-3`

## Adding a video is intentionally simple

You do **not** create a new HTML block or page.

The same `index.html` automatically renders the gallery and every edit page from `edits.json`.

### Fastest possible workflow

1. Put your MP4 in `media/` using the edit ID as its filename.

Example:

`media/newedit.mp4`

2. Add this one object to `edits.json`:

```json
{ "id": "newedit" }
```

That is enough. The site automatically assumes:

- title: `newedit`
- file: `media/newedit.mp4`
- download name: `newedit.mp4`
- meta: the next `edit 00X` number
- separate reactions/comments/views for that ID

### Optional fields

Use these only when you want to customize something:

```json
{
  "id": "newedit",
  "title": "new edit",
  "meta": "edit 002",
  "file": "media/newedit-v2.mp4",
  "poster": "thumbs/newedit.jpg",
  "downloadName": "newedit.mp4",
  "description": "optional description"
}
```

`id` is the only required field. IDs may contain letters, numbers, `-`, and `_`.

## Replacing a video

For reliable browser caching, use a new filename instead of overwriting an old MP4:

`media/newedit-v1.mp4` → `media/newedit-v2.mp4`

Then only change that edit's `file` value in `edits.json`.

## Posters / thumbnails

Posters are optional. Put one in `thumbs/` and set:

```json
"poster": "thumbs/newedit.jpg"
```

If the poster fails, the gallery automatically falls back to the video preview. If the video itself is missing, the site now shows a clear "Video file not found" state instead of a mysterious black box.

## IntenseDebate — one-time setup

You do not edit `site.js` for comments anymore.

1. Register/link your public site inside IntenseDebate.
2. Get the `idcomments_acct` value IntenseDebate gives that site.
3. Open `site-config.js` once and paste it here:

```js
intenseDebateAccountId: "YOUR_VALUE_HERE"
```

If this value is blank, the Comments section is hidden completely. Once configured, every edit automatically gets a separate stable thread using its edit `id`.

## GoatCounter

GoatCounter is configured for:

`https://sainthamudidisciple.goatcounter.com/count`

The build/cache query is no longer part of the analytics identity, so deploy/version changes do not split an edit's view counts. The script is pinned to GoatCounter `count.v5.js` with SRI integrity checking.

If visible visitor counts are disabled in GoatCounter settings, the page safely falls back to `views tracked`.

## Reactions

CounterAPI reactions stay intentionally casual. The browser remembers reactions when localStorage is available, but this is not meant to be secure voting.

If localStorage is blocked, the rest of the edit page no longer breaks.

## Files you normally touch

For ordinary new uploads:

```text
edits.json
media/your-edit.mp4
thumbs/your-edit.jpg   (optional)
```

You normally do **not** touch:

```text
index.html
site.js
style.css
site-config.js         (except one-time IntenseDebate setup)
```

## Project structure

```text
repo/
├── index.html
├── style.css
├── site.js
├── site-config.js
├── edits.json
├── version.json
├── media/
│   ├── basedtfrtfd-v1.mp4
│   └── future-edit.mp4
└── thumbs/
    └── optional-thumbnails.jpg
```

## Important note about this ZIP

The source ZIP did not contain `media/basedtfrtfd-v1.mp4`; it only contained `media/.gitkeep`. Copy your actual MP4 into `media/` before deploying or change the `file` field to the filename you upload.
