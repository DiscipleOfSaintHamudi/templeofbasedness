/* =========================================================
   @itneverbegunn edits archive
   Content comes from edits.json. Adding an edit should not
   require changing this file.
   ========================================================= */

const CONFIG = window.SITE_CONFIG || {};
const REACTION_NAMESPACE = CONFIG.reactionNamespace || "itneverbegunn";
const REACTIONS = ["fire", "heart", "laugh", "skull"];
const REACTION_EMOJI = { fire: "🔥", heart: "❤️", laugh: "😂", skull: "💀" };
const REACTION_LABEL = { fire: "Fire", heart: "Heart", laugh: "Laugh", skull: "Skull" };
let EDITS = [];

/* ---------- utilities ---------- */
function qs(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePath(path) {
  if (!path) return "";
  return String(path).replace(/^\.\//, "");
}

function getEditFile(edit) {
  return normalizePath(edit.file || `media/${edit.id}.mp4`);
}

function getEditTitle(edit) {
  return String(edit.title || edit.id);
}

function getEditMeta(edit, index) {
  return String(edit.meta || `edit ${String(index + 1).padStart(3, "0")}`);
}

function getDownloadName(edit) {
  return String(edit.downloadName || `${edit.id}.mp4`);
}

function cleanPageURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete("v");
  return url;
}

function canonicalEditURL(editId) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("edit", editId);
  return url.toString();
}

function editHref(editId) {
  const url = cleanPageURL();
  url.searchParams.set("edit", editId);
  return url.pathname + "?" + url.searchParams.toString();
}

function homeHref() {
  const url = cleanPageURL();
  url.searchParams.delete("edit");
  return url.pathname + (url.search ? url.search : "");
}

function storageGet(key) {
  try { return window.localStorage.getItem(key); }
  catch { return null; }
}

function storageSet(key, value) {
  try { window.localStorage.setItem(key, value); }
  catch { /* reactions still work when storage is blocked */ }
}

function setMeta(name, content, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

function updatePageMeta(edit) {
  const handle = CONFIG.handle || "@itneverbegunn";
  if (!edit) {
    document.title = handle;
    setMeta("description", `${handle} edits archive`);
    setCanonical(window.location.origin + window.location.pathname);
    setMeta("og:title", handle, true);
    setMeta("og:description", `${handle} edits archive`, true);
    setMeta("og:url", window.location.origin + window.location.pathname, true);
    setMeta("og:type", "website", true);
    return;
  }

  const title = `${getEditTitle(edit)} — ${handle}`;
  const description = edit.description || `${getEditTitle(edit)} by ${handle}`;
  const url = canonicalEditURL(edit.id);
  document.title = title;
  setMeta("description", description);
  setCanonical(url);
  setMeta("og:title", title, true);
  setMeta("og:description", description, true);
  setMeta("og:url", url, true);
  setMeta("og:type", "video.other", true);
  if (edit.poster) setMeta("og:image", new URL(edit.poster, window.location.href).toString(), true);
}

/* ---------- content loading ---------- */
async function loadEdits() {
  const response = await fetch(`./edits.json?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load edits.json (${response.status})`);

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("edits.json must contain a JSON array.");

  const ids = new Set();
  for (const edit of data) {
    if (!edit || typeof edit !== "object") throw new Error("Every edit must be an object.");
    if (!edit.id || typeof edit.id !== "string") throw new Error("Every edit needs a string id.");
    if (!/^[a-zA-Z0-9_-]+$/.test(edit.id)) {
      throw new Error(`Invalid edit id "${edit.id}". Use only letters, numbers, - and _.`);
    }
    if (ids.has(edit.id)) throw new Error(`Duplicate edit id: ${edit.id}`);
    ids.add(edit.id);
  }
  return data;
}

/* ---------- media helpers ---------- */
function mediaErrorMarkup(message = "Video unavailable") {
  return `<div class="media-error" role="status"><span>⚠</span>${escapeHTML(message)}</div>`;
}

function bindMediaErrors(root = document) {
  root.querySelectorAll("video").forEach(video => {
    video.addEventListener("error", () => {
      const host = video.closest(".card-media, .edit-media");
      if (host && !host.querySelector(".media-error")) {
        host.insertAdjacentHTML("beforeend", mediaErrorMarkup("Video file not found"));
      }
    }, { once: true });
  });

  root.querySelectorAll("img[data-poster]").forEach(img => {
    img.addEventListener("error", () => {
      const fallbackSrc = img.dataset.videoSrc;
      if (!fallbackSrc) return;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.innerHTML = `<source src="${escapeHTML(fallbackSrc)}" type="video/mp4">`;
      img.replaceWith(video);
      bindMediaErrors(video.parentElement || document);
    }, { once: true });
  });
}

/* ---------- gallery ---------- */
function renderHome() {
  const app = document.getElementById("app");
  updatePageMeta(null);

  const cards = EDITS.map((edit, index) => {
    const href = editHref(edit.id);
    const file = getEditFile(edit);
    const title = getEditTitle(edit);
    const poster = edit.poster
      ? `<img src="${escapeHTML(edit.poster)}" data-poster data-video-src="${escapeHTML(file)}" alt="${escapeHTML(title)} thumbnail" loading="lazy" decoding="async">`
      : `<video muted playsinline preload="metadata" aria-hidden="true"><source src="${escapeHTML(file)}" type="video/mp4"></video>`;

    return `
      <article class="card">
        <a class="card-media" href="${escapeHTML(href)}" aria-label="Open ${escapeHTML(title)}">
          ${poster}
          <span class="card-overlay" aria-hidden="true">▶</span>
        </a>
        <div class="card-body">
          <div class="card-title">${escapeHTML(title)}</div>
          <div class="card-meta">${escapeHTML(getEditMeta(edit, index))}</div>
          <div class="card-actions">
            <a class="small-action" href="${escapeHTML(href)}">Watch</a>
            <a class="small-action" href="${escapeHTML(file)}" download="${escapeHTML(getDownloadName(edit))}">Download</a>
          </div>
        </div>
      </article>`;
  }).join("");

  app.innerHTML = `
    <div class="section-head">
      <h2>Latest edits</h2>
      <span>${EDITS.length} ${EDITS.length === 1 ? "edit" : "edits"}</span>
    </div>
    <section class="grid">${cards || `<div class="loading">No edits yet.</div>`}</section>`;

  bindMediaErrors(app);
}

/* ---------- edit detail ---------- */
function renderEdit(edit) {
  const app = document.getElementById("app");
  const file = getEditFile(edit);
  const title = getEditTitle(edit);
  const commentsEnabled = Boolean(CONFIG.intenseDebateAccountId);
  const editIndex = Math.max(0, EDITS.findIndex(item => item.id === edit.id));
  updatePageMeta(edit);

  app.innerHTML = `
    <a class="back" href="${escapeHTML(homeHref())}">← Back to edits</a>

    <article class="edit-card">
      <div class="edit-media">
        <video controls playsinline preload="metadata"${edit.poster ? ` poster="${escapeHTML(edit.poster)}"` : ""}>
          <source src="${escapeHTML(file)}" type="video/mp4">
          Your browser does not support HTML5 video.
        </video>
      </div>
      <div class="edit-info">
        <h2 class="edit-title">${escapeHTML(title)}</h2>
        <div class="edit-meta">${escapeHTML(getEditMeta(edit, editIndex))}</div>
        <div class="stats" aria-label="View count">👁 <span id="view-count">loading views…</span></div>
        <a class="download" href="${escapeHTML(file)}" download="${escapeHTML(getDownloadName(edit))}">↓ Download MP4</a>
      </div>
    </article>

    <section class="section">
      <h2>Reactions</h2>
      <div class="reactions">
        ${REACTIONS.map(type => `
          <button class="reaction" type="button" data-reaction="${type}" aria-label="React with ${REACTION_LABEL[type]}">
            <span aria-hidden="true">${REACTION_EMOJI[type]}</span> <span id="${type}-count" aria-label="count">…</span>
          </button>`).join("")}
      </div>
      <div class="status" id="reaction-status" aria-live="polite"></div>
    </section>

    ${commentsEnabled ? `
      <section class="section" id="comments-section">
        <h2>Comments</h2>
        <div class="comments-loading" id="comments-placeholder">loading comments…</div>
        <span id="IDCommentsPostTitle" style="display:none"></span>
      </section>` : ""}
  `;

  bindMediaErrors(app);
  initVisibleViews(edit);
  initReactions(edit);
  if (commentsEnabled) initIntenseDebate(edit);
}

/* ---------- GoatCounter visible count ---------- */
function analyticsPathForEdit(edit) {
  return edit ? `${window.location.pathname}?edit=${encodeURIComponent(edit.id)}` : window.location.pathname;
}

function initVisibleViews(edit) {
  const holder = document.getElementById("view-count");
  if (!holder) return;
  let rendered = false;

  function showCount() {
    if (rendered) return;
    if (!window.goatcounter || typeof window.goatcounter.visit_count !== "function") {
      holder.textContent = "views tracked";
      return;
    }
    rendered = true;
    holder.textContent = "";
    try {
      window.goatcounter.visit_count({
        append: "#view-count",
        type: "html",
        no_branding: true,
        path: analyticsPathForEdit(edit)
      });
    } catch (err) {
      console.warn("Public GoatCounter count unavailable:", err);
      holder.textContent = "views tracked";
    }
  }

  window.addEventListener("goatcounter-ready", showCount, { once: true });
  window.setTimeout(showCount, 1200);
}

/* ---------- shared reactions ---------- */
function setReactionStatus(text) {
  const el = document.getElementById("reaction-status");
  if (el) el.textContent = text || "";
}

function reactionCounterURL(editId, type, readOnly) {
  const base = `https://counterapi.com/api/${encodeURIComponent(REACTION_NAMESPACE)}/${encodeURIComponent(type)}/${encodeURIComponent(editId)}`;
  const params = new URLSearchParams({ behavior: "vote", _ts: Date.now().toString() });
  if (readOnly) params.set("readOnly", "true");
  return `${base}?${params.toString()}`;
}

async function readReaction(editId, type) {
  const target = document.getElementById(`${type}-count`);
  try {
    const response = await fetch(reactionCounterURL(editId, type, true), { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (target) target.textContent = data.value ?? 0;
  } catch (err) {
    console.warn("Reaction read failed:", editId, type, err);
    if (target) target.textContent = "—";
  }
}

async function voteReaction(editId, type) {
  const storageKey = `reaction:${editId}:${type}`;
  const button = document.querySelector(`[data-reaction="${type}"]`);
  if (storageGet(storageKey)) {
    setReactionStatus("You already used that reaction on this browser.");
    return;
  }

  if (button) button.disabled = true;
  setReactionStatus("saving reaction…");
  try {
    const response = await fetch(reactionCounterURL(editId, type, false), { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const target = document.getElementById(`${type}-count`);
    if (target) target.textContent = data.value ?? 0;
    storageSet(storageKey, "1");
    if (button) button.classList.add("voted");
    setReactionStatus("Reaction saved.");
  } catch (err) {
    console.warn("Reaction vote failed:", editId, type, err);
    setReactionStatus("Reaction failed to save. Try again.");
  } finally {
    if (button) button.disabled = false;
  }
}

function initReactions(edit) {
  document.querySelectorAll("[data-reaction]").forEach(button => {
    const type = button.dataset.reaction;
    if (storageGet(`reaction:${edit.id}:${type}`)) button.classList.add("voted");
    button.addEventListener("click", () => voteReaction(edit.id, type));
  });
  REACTIONS.forEach(type => readReaction(edit.id, type));
}

/* ---------- IntenseDebate ---------- */
function initIntenseDebate(edit) {
  const accountId = String(CONFIG.intenseDebateAccountId || "").trim();
  if (!accountId) return;

  window.idcomments_acct = accountId;
  window.idcomments_post_id = edit.id;
  window.idcomments_post_url = canonicalEditURL(edit.id);

  const placeholder = document.getElementById("comments-placeholder");
  const script = document.createElement("script");
  script.src = "https://www.intensedebate.com/js/genericCommentWrapperV2.js";
  script.async = true;
  script.onload = () => { if (placeholder) placeholder.remove(); };
  script.onerror = () => { if (placeholder) placeholder.textContent = "Comments could not load."; };
  document.getElementById("comments-section")?.appendChild(script);
}

/* ---------- boot ---------- */
async function boot() {
  const app = document.getElementById("app");
  try {
    EDITS = await loadEdits();
    const requestedId = qs("edit");
    if (!requestedId) return renderHome();

    const edit = EDITS.find(item => item.id === requestedId);
    if (!edit) {
      document.title = `Edit not found — ${CONFIG.handle || "@itneverbegunn"}`;
      app.innerHTML = `<div class="error">Edit not found.<br><br><a class="back" href="${escapeHTML(homeHref())}">← Back to edits</a></div>`;
      return;
    }
    renderEdit(edit);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="error">Could not load the edits archive.<br><span>${escapeHTML(err.message)}</span></div>`;
  }
}

boot();
