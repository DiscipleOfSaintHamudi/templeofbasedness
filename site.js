/* =========================================================
   @itneverbegunn edits archive
   Content comes from edits.json. Adding an edit should not
   require changing this file.
   ========================================================= */

const CONFIG = window.SITE_CONFIG || {};
let EDITS = [];
let reactionPollTimer = null;
let reactionPickerModulePromise = null;

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

function getEditPreview(edit) {
  return normalizePath(edit.preview || getEditFile(edit));
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
  catch { /* site remains usable if localStorage is blocked */ }
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

  const title = `${getEditTitle(edit)} â€” ${handle}`;
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
  return `<div class="media-error" role="status"><span>âš </span>${escapeHTML(message)}</div>`;
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
    const preview = getEditPreview(edit);
    const title = getEditTitle(edit);
    const poster = edit.poster
      ? `<img src="${escapeHTML(edit.poster)}" data-poster data-video-src="${escapeHTML(preview)}" alt="${escapeHTML(title)} thumbnail" loading="lazy" decoding="async">`
      : `<video muted playsinline preload="metadata" aria-hidden="true"><source src="${escapeHTML(preview)}" type="video/mp4"></video>`;

    return `
      <article class="card">
        <a class="card-media" href="${escapeHTML(href)}" aria-label="Open ${escapeHTML(title)}">
          ${poster}
          <span class="card-overlay" aria-hidden="true">â–¶</span>
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
  const preview = getEditPreview(edit);
  const title = getEditTitle(edit);
  const commentsEnabled = Boolean(String(CONFIG.intenseDebateAccountId || "").trim());
  const editIndex = Math.max(0, EDITS.findIndex(item => item.id === edit.id));
  updatePageMeta(edit);

  app.innerHTML = `
    <a class="back" href="${escapeHTML(homeHref())}">â† Back to edits</a>

    <article class="edit-card">
      <div class="edit-media">
        <video controls playsinline preload="metadata"${edit.poster ? ` poster="${escapeHTML(edit.poster)}"` : ""}>
          <source src="${escapeHTML(preview)}" type="video/mp4">
          Your browser does not support HTML5 video.
        </video>
      </div>
      <div class="edit-info">
        <h2 class="edit-title">${escapeHTML(title)}</h2>
        <div class="edit-meta">${escapeHTML(getEditMeta(edit, editIndex))}</div>
        <div class="stats" aria-label="View count"><span class="view-icon" aria-hidden="true">ðŸ‘</span><span id="view-count">â€”</span></div>
        <a class="download" href="${escapeHTML(file)}" download="${escapeHTML(getDownloadName(edit))}">â†“ Download MP4</a>
      </div>
    </article>

    <section class="section">
      <div class="reaction-heading">
        <h2>Reactions</h2>
        <span class="reaction-hint">community</span>
      </div>
      <div class="reaction-bar">
        <div class="reactions" id="active-reactions" aria-live="polite"></div>
        <button class="reaction-add" id="reaction-add" type="button" aria-label="Add a reaction" aria-expanded="false" aria-controls="reaction-picker">+</button>
      </div>
      <div class="reaction-picker" id="reaction-picker" hidden></div>
      <div class="status" id="reaction-status" aria-live="polite"></div>
    </section>

    ${commentsEnabled ? `
      <section class="section comments-section" id="comments-section">
        <h2>Comments</h2>
        <div class="comments-loading" id="comments-placeholder">loading commentsâ€¦</div>
        <span id="IDCommentsPostTitle" style="display:none"></span>
      </section>` : ""}
  `;

  bindMediaErrors(app);
  initVisibleViews(edit);
  initReactions(edit);
  if (commentsEnabled) initIntenseDebate(edit);
}

/* ---------- GoatCounter: modern text count, no iframe ---------- */
function analyticsPathForEdit(edit) {
  return edit ? `${window.location.pathname}?edit=${encodeURIComponent(edit.id)}` : window.location.pathname;
}

function goatCounterOrigin() {
  try {
    return new URL(String(CONFIG.goatCounterURL || "")).origin;
  } catch {
    return "";
  }
}

function fetchGoatCounterCount(path) {
  return new Promise((resolve, reject) => {
    const origin = goatCounterOrigin();

    if (!origin) {
      reject(new Error("GoatCounter URL is not configured"));
      return;
    }

    const url = `${origin}/counter/${encodeURIComponent(path)}.json`;
    const xhr = new XMLHttpRequest();

    xhr.open("GET", url, true);
    xhr.timeout = 8000;

    xhr.onload = function () {
      if (xhr.status === 404) {
        resolve("0");
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`GoatCounter counter returned ${xhr.status}`));
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText);

        if (!data || typeof data.count !== "string") {
          throw new Error("Unexpected GoatCounter response");
        }

        resolve(data.count);
      } catch (error) {
        reject(error);
      }
    };

    xhr.onerror = function () {
      reject(new Error("GoatCounter network request failed"));
    };

    xhr.ontimeout = function () {
      reject(new Error("GoatCounter request timed out"));
    };

    xhr.send();
  });
}

async function initVisibleViews(edit) {
  const holder = document.getElementById("view-count");
  if (!holder) return;
  holder.textContent = "â€¦";

  // Give count.js a moment to record this pageview before reading the public counter.
  await new Promise(resolve => setTimeout(resolve, 900));

  try {
    const count = await fetchGoatCounterCount(analyticsPathForEdit(edit));
    holder.textContent = `${count} ${count === "1" ? "view" : "views"}`;
  } catch (error) {
    console.warn("Visible GoatCounter count unavailable:", error);
    holder.textContent = "— views";
  }
}

/* ---------- shared community reactions ---------- */
const REACTION_DB = String(CONFIG.reactionDatabaseURL || "").trim().replace(/\/$/, "");

function setReactionStatus(message) {
  const el = document.getElementById("reaction-status");
  if (el) el.textContent = message || "";
}

function emojiStorageKey(editId, emoji) {
  return `reaction:${editId}:${Array.from(emoji).map(ch => ch.codePointAt(0).toString(16)).join("-")}`;
}

function emojiDbKey(emoji) {
  const bytes = new TextEncoder().encode(emoji);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function reactionPath(editId, emoji) {
  return `${REACTION_DB}/reactions/${encodeURIComponent(editId)}/${emojiDbKey(emoji)}.json`;
}

function reactionEditPath(editId) {
  return `${REACTION_DB}/reactions/${encodeURIComponent(editId)}.json`;
}

function isReasonableEmoji(value) {
  if (typeof value !== "string") return false;
  const emoji = value.trim();
  if (!emoji || emoji.length > 40) return false;
  // Covers pictographs plus flags/keycaps. This is validation, not the picker catalog.
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(emoji);
}

function reactionButton(editId, emoji, count) {
  const button = document.createElement("button");
  button.className = "reaction";
  button.type = "button";
  button.dataset.emoji = emoji;
  button.setAttribute("aria-label", `${emoji} reaction, ${count}`);
  if (storageGet(emojiStorageKey(editId, emoji))) button.classList.add("voted");
  button.innerHTML = `<span class="reaction-emoji" aria-hidden="true">${escapeHTML(emoji)}</span><span class="reaction-count">${escapeHTML(count)}</span>`;
  button.addEventListener("click", () => voteReaction(editId, emoji));
  return button;
}

function renderReactionSnapshot(editId, data) {
  const holder = document.getElementById("active-reactions");
  if (!holder) return;

  const entries = data && typeof data === "object"
    ? Object.values(data)
        .filter(item => item && isReasonableEmoji(item.emoji) && Number(item.count) > 0)
        .map(item => ({ emoji: item.emoji, count: Number(item.count) }))
        .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
    : [];

  const existing = new Map(Array.from(holder.querySelectorAll(".reaction")).map(btn => [btn.dataset.emoji, btn]));
  const seen = new Set();

  for (const item of entries) {
    seen.add(item.emoji);
    let button = existing.get(item.emoji);
    if (!button) {
      button = reactionButton(editId, item.emoji, item.count);
    } else {
      const countEl = button.querySelector(".reaction-count");
      if (countEl) countEl.textContent = String(item.count);
      button.setAttribute("aria-label", `${item.emoji} reaction, ${item.count}`);
      button.classList.toggle("voted", Boolean(storageGet(emojiStorageKey(editId, item.emoji))));
    }
    holder.appendChild(button); // also keeps order synced with counts
  }

  existing.forEach((button, emoji) => {
    if (!seen.has(emoji)) button.remove();
  });
}

async function loadCommunityReactions(editId, { quiet = false } = {}) {
  if (!REACTION_DB) {
    if (!quiet) setReactionStatus("Reaction database is not configured.");
    return;
  }

  try {
    const response = await fetch(reactionEditPath(editId), { cache: "no-store" });
    if (response.status === 401 || response.status === 403) {
      throw new Error("Firebase rules are blocking public reactions");
    }
    if (!response.ok) throw new Error(`Reaction database returned ${response.status}`);
    const data = await response.json();
    renderReactionSnapshot(editId, data);
    if (!quiet) setReactionStatus("");
  } catch (error) {
    console.error("Could not load community reactions", error);
    if (!quiet) setReactionStatus("Could not load community reactions. Check Firebase database rules.");
  }
}

async function firebaseIncrement(editId, emoji) {
  const url = reactionPath(editId, emoji);

  // Optimistic-concurrency loop prevents two simultaneous clicks from clobbering a count.
  for (let attempt = 0; attempt < 8; attempt++) {
    const read = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "X-Firebase-ETag": "true" }
    });
    if (!read.ok) throw new Error(`Reaction read failed (${read.status})`);

    const etag = read.headers.get("ETag") || "null_etag";
    const current = await read.json();
    const next = {
      emoji,
      count: Math.max(0, Number(current?.count) || 0) + 1,
      updatedAt: Date.now()
    };

    const write = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "if-match": etag
      },
      body: JSON.stringify(next)
    });

    if (write.status === 412) continue;
    if (!write.ok) throw new Error(`Reaction write failed (${write.status})`);
    return next.count;
  }

  throw new Error("Reaction changed too quickly; try again.");
}

async function voteReaction(editId, rawEmoji) {
  if (!REACTION_DB) {
    setReactionStatus("Reaction database is not configured.");
    return;
  }

  const emoji = String(rawEmoji || "").trim();
  if (!isReasonableEmoji(emoji)) {
    setReactionStatus("Choose a valid emoji.");
    return;
  }

  const storageKey = emojiStorageKey(editId, emoji);
  if (storageGet(storageKey)) {
    setReactionStatus(`You already added ${emoji} on this edit.`);
    closeReactionPicker();
    return;
  }

  document.querySelectorAll(".reaction, #reaction-add").forEach(button => { button.disabled = true; });
  try {
    await firebaseIncrement(editId, emoji);
    storageSet(storageKey, "1");
    await loadCommunityReactions(editId, { quiet: true });
    setReactionStatus(`${emoji} added.`);
    closeReactionPicker();
  } catch (error) {
    console.error("Reaction failed", error);
    if (/401|403|rules/i.test(String(error))) {
      setReactionStatus("Firebase is blocking writes. Check Realtime Database rules.");
    } else {
      setReactionStatus("Reaction failed. Try again.");
    }
  } finally {
    document.querySelectorAll(".reaction, #reaction-add").forEach(button => { button.disabled = false; });
  }
}

function closeReactionPicker() {
  const picker = document.getElementById("reaction-picker");
  const add = document.getElementById("reaction-add");
  if (picker) picker.hidden = true;
  if (add) {
    add.classList.remove("open");
    add.setAttribute("aria-expanded", "false");
  }
}

async function ensureEmojiPickerModule() {
  if (customElements.get("emoji-picker")) return true;
  if (!reactionPickerModulePromise) {
    reactionPickerModulePromise = (async () => {
      const sources = [
        "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/index.js",
        "https://unpkg.com/emoji-picker-element@1.29.1/index.js"
      ];
      for (const src of sources) {
        try {
          await import(src);
          if (customElements.get("emoji-picker")) return true;
        } catch (error) {
          console.warn("Emoji picker CDN failed:", src, error);
        }
      }
      return false;
    })();
  }
  return reactionPickerModulePromise;
}

function renderEmojiFallback(picker) {
  picker.innerHTML = `
    <div class="emoji-fallback">
      <label for="emoji-fallback-input">Paste any Unicode emoji</label>
      <div class="emoji-fallback-row">
        <input id="emoji-fallback-input" type="text" inputmode="text" maxlength="40" autocomplete="off" placeholder="ðŸ¦…">
        <button id="emoji-fallback-submit" type="button">Add</button>
      </div>
    </div>`;

  const input = picker.querySelector("#emoji-fallback-input");
  const submit = picker.querySelector("#emoji-fallback-submit");
  const add = () => voteReaction(window.__reactionEditId, input?.value || "");
  submit?.addEventListener("click", add);
  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") add();
  });
  input?.focus();
}

async function openReactionPicker() {
  const picker = document.getElementById("reaction-picker");
  const add = document.getElementById("reaction-add");
  if (!picker || !add) return;

  if (!REACTION_DB) {
    setReactionStatus("Reaction database is not configured.");
    return;
  }

  picker.hidden = false;
  add.classList.add("open");
  add.setAttribute("aria-expanded", "true");

  if (picker.querySelector("emoji-picker, .emoji-fallback")) return;
  picker.innerHTML = `<div class="picker-loading">loading emoji pickerâ€¦</div>`;

  const loaded = await ensureEmojiPickerModule();
  if (!loaded) {
    renderEmojiFallback(picker);
    return;
  }

  const emojiPicker = document.createElement("emoji-picker");
  emojiPicker.className = "unicode-emoji-picker";
  picker.replaceChildren(emojiPicker);
  emojiPicker.addEventListener("emoji-click", event => {
    const emoji = event.detail?.unicode || event.detail?.emoji?.unicode;
    if (emoji) voteReaction(window.__reactionEditId, emoji);
  });
}

function startReactionPolling(editId) {
  if (reactionPollTimer) clearInterval(reactionPollTimer);
  reactionPollTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      loadCommunityReactions(editId, { quiet: true });
    }
  }, 7000);
}

function initReactions(edit) {
  window.__reactionEditId = edit.id;
  const add = document.getElementById("reaction-add");
  const picker = document.getElementById("reaction-picker");

  add?.addEventListener("click", () => {
    if (picker?.hidden) openReactionPicker();
    else closeReactionPicker();
  });

  document.addEventListener("click", event => {
    if (!picker || picker.hidden) return;
    if (picker.contains(event.target) || add?.contains(event.target)) return;
    closeReactionPicker();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeReactionPicker();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadCommunityReactions(edit.id, { quiet: true });
  });

  // No preset/stale zeroes: only reactions actually present in Firebase with count > 0 are shown.
  loadCommunityReactions(edit.id);
  startReactionPolling(edit.id);
}

/* ---------- IntenseDebate ---------- */
function fieldLooksLikeGuestExtra(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  const haystack = [
    input.type,
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
    input.autocomplete
  ].filter(Boolean).join(" ").toLowerCase();
  return input.type === "email" || /(^|\W)(e-?mail|website|web\s*site|homepage|url)(\W|$)/i.test(haystack);
}

function hideFieldAndSmallWrapper(input, container) {
  input.required = false;
  input.removeAttribute("required");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.style.setProperty("display", "none", "important");

  if (input.id) {
    try {
      container.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`).forEach(label => {
        label.style.setProperty("display", "none", "important");
      });
    } catch { /* old browsers */ }
  }

  // Hide only a small field wrapper. Never hide a wrapper containing the comment textarea.
  let parent = input.parentElement;
  for (let depth = 0; parent && depth < 4 && parent !== container; depth++, parent = parent.parentElement) {
    if (parent.querySelector("textarea")) break;
    const controls = parent.querySelectorAll("input,select,textarea,button").length;
    const text = (parent.textContent || "").replace(/\s+/g, " ").trim();
    if (controls <= 2 && text.length < 180 && /(e-?mail|website|web\s*site|homepage|url)/i.test(text)) {
      parent.style.setProperty("display", "none", "important");
      return;
    }
  }
}

function cleanupIntenseDebateGuestForm(root = document) {
  const container = root.querySelector?.("#idc-container") || document.querySelector("#idc-container");
  if (!container) return false;

  container.querySelectorAll("input").forEach(input => {
    if (fieldLooksLikeGuestExtra(input)) hideFieldAndSmallWrapper(input, container);
  });

  container.querySelectorAll("label").forEach(label => {
    const text = (label.textContent || "").trim();
    if (/^(e-?mail|website|web\s*site|homepage|url)\b/i.test(text)) {
      label.style.setProperty("display", "none", "important");
    }
  });

  return true;
}

function watchIntenseDebateGuestForm(section) {
  let timer = null;
  const apply = () => {
    clearTimeout(timer);
    timer = setTimeout(() => cleanupIntenseDebateGuestForm(section), 20);
  };
  const observer = new MutationObserver(apply);
  observer.observe(section, { childList: true, subtree: true, attributes: true });
  apply();
  return observer;
}

function initIntenseDebate(edit) {
  const accountId = String(CONFIG.intenseDebateAccountId || "").trim();
  if (!accountId) return;

  const section = document.getElementById("comments-section");
  const placeholder = document.getElementById("comments-placeholder");
  if (!section) return;

  // Stable thread identity: never include build/cache-busting params.
  window.idcomments_acct = accountId;
  window.idcomments_post_id = edit.id;
  window.idcomments_post_url = canonicalEditURL(edit.id);

  watchIntenseDebateGuestForm(section);

  const script = document.createElement("script");
  script.src = "https://www.intensedebate.com/js/genericCommentWrapperV2.js";
  script.async = true;

  let attempts = 0;
  const waitForContainer = () => {
    attempts += 1;
    const found = cleanupIntenseDebateGuestForm(section);
    if (found) {
      placeholder?.remove();
      // IntenseDebate mutates the form after login/guest mode changes; re-apply a few times.
      [250, 750, 1500, 3000].forEach(delay => setTimeout(() => cleanupIntenseDebateGuestForm(section), delay));
      return;
    }
    if (attempts < 40) {
      setTimeout(waitForContainer, 250);
    } else if (placeholder) {
      placeholder.textContent = "Comments could not load. A privacy blocker may be blocking IntenseDebate.";
    }
  };

  script.onload = waitForContainer;
  script.onerror = () => {
    if (placeholder) placeholder.textContent = "Comments could not load. A privacy blocker may be blocking IntenseDebate.";
  };

  section.appendChild(script);
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
      document.title = `Edit not found â€” ${CONFIG.handle || "@itneverbegunn"}`;
      app.innerHTML = `<div class="error">Edit not found.<br><br><a class="back" href="${escapeHTML(homeHref())}">â† Back to edits</a></div>`;
      return;
    }
    renderEdit(edit);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="error">Could not load the edits archive.<br><span>${escapeHTML(err.message)}</span></div>`;
  }
}

boot();
