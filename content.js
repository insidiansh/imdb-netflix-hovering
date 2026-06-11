(function () {
  const host = location.hostname;
  let site = "";
  if (host.includes("netflix.com")) site = "netflix";
  else if (host.includes("hotstar.com")) site = "hotstar";
  else site = "prime";

  // Selectors per site for cards/tiles we want to attach hovers to.
  const SELECTORS = {
    netflix: [
      ".title-card",
      ".slider-refocus",
      "[data-uia='title-card']",
      ".previewModal--container",
    ],
    prime: [
      "[data-testid='card']",
      "[data-testid='title']",
      "article[data-card-title]",
      "a[aria-label]",
    ],
    hotstar: [
      "[data-testid*='card']",
      "a[aria-label]",
      ".tray-vertical-card",
    ],
  };

  function extractTitle(el) {
    // Try common attributes/text containers
    const candidates = [];
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) candidates.push(aria);
    const dct = el.getAttribute && el.getAttribute("data-card-title");
    if (dct) candidates.push(dct);
    const alt = el.querySelector && el.querySelector("img[alt]");
    if (alt && alt.getAttribute("alt")) candidates.push(alt.getAttribute("alt"));
    const titleEl = el.querySelector && el.querySelector(
      ".fallback-text, .title-card-title, p, h2, h3, span"
    );
    if (titleEl && titleEl.textContent) candidates.push(titleEl.textContent);

    for (let raw of candidates) {
      if (!raw) continue;
      let t = raw.trim();
      // strip durations, "Watch", season suffixes
      t = t.replace(/\bSeason\b.*$/i, "")
           .replace(/\bS\d+\s*E\d+\b.*$/i, "")
           .replace(/^Watch\s+/i, "")
           .replace(/\s*\|.*$/, "")
           .replace(/\s*-\s*(Official|Trailer|Episode).*$/i, "")
           .replace(/\s{2,}/g, " ")
           .trim();
      if (t.length >= 2 && t.length < 120) return t;
    }
    return null;
  }

  // Tooltip
  let tip;
  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "imdb-ext-tooltip";
    tip.style.display = "none";
    document.body.appendChild(tip);
    return tip;
  }
  function showTip(x, y, html) {
    const t = ensureTip();
    t.innerHTML = html;
    t.style.display = "block";
    const pad = 14;
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = x + pad, top = y + pad;
    if (left + w > window.innerWidth - 8) left = x - w - pad;
    if (top + h > window.innerHeight - 8) top = y - h - pad;
    t.style.left = Math.max(4, left) + "px";
    t.style.top = Math.max(4, top) + "px";
  }
  function hideTip() {
    if (tip) tip.style.display = "none";
  }

  function renderRating(data) {
    if (!data) return `<div class="imdb-ext-row">No data</div>`;
    if (data.error === "NO_KEY") {
      return `<div class="imdb-ext-row imdb-ext-warn">Set your free OMDb API key in the extension popup.</div>`;
    }
    if (data.error === "NOT_FOUND") {
      return `<div class="imdb-ext-row">No IMDb match found.</div>`;
    }
    if (data.error) {
      return `<div class="imdb-ext-row imdb-ext-warn">Network error.</div>`;
    }
    const r = data.rating && data.rating !== "N/A" ? data.rating : "—";
    return `
      <div class="imdb-ext-head">
        <span class="imdb-ext-star">★</span>
        <span class="imdb-ext-rating">${r}</span>
        <span class="imdb-ext-of">/10</span>
      </div>
      <div class="imdb-ext-title">${data.title || ""} <span class="imdb-ext-year">(${data.year || ""})</span></div>
      ${data.votes && data.votes !== "N/A" ? `<div class="imdb-ext-votes">${data.votes} votes</div>` : ""}
    `;
  }

  const pending = new Map();
  function requestRating(title) {
    if (pending.has(title)) return pending.get(title);
    const p = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GET_RATING", title }, (resp) => {
          resolve(resp);
        });
      } catch (e) {
        resolve({ error: "NETWORK" });
      }
    });
    pending.set(title, p);
    return p;
  }

  let hoverToken = 0;
  let currentEl = null;
  let hoverTimer = null;

  function findCard(el) {
    const sels = SELECTORS[site];
    for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
      for (const s of sels) {
        if (cur.matches && cur.matches(s)) return cur;
      }
    }
    return null;
  }

  document.addEventListener("mousemove", (e) => {
    const card = findCard(e.target);
    if (card === currentEl) {
      if (tip && tip.style.display === "block") {
        // reposition softly
        showTip(e.clientX, e.clientY, tip.innerHTML);
      }
      return;
    }
    currentEl = card;
    clearTimeout(hoverTimer);
    if (!card) { hideTip(); return; }

    const x = e.clientX, y = e.clientY;
    hoverTimer = setTimeout(async () => {
      const title = extractTitle(card);
      if (!title) return;
      const myToken = ++hoverToken;
      showTip(x, y, `<div class="imdb-ext-row">Loading IMDb…<br><span class="imdb-ext-sub">${title}</span></div>`);
      const data = await requestRating(title);
      if (myToken !== hoverToken) return;
      showTip(x, y, renderRating(data));
    }, 350);
  }, true);

  document.addEventListener("scroll", hideTip, true);
})();