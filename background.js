const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getApiKey() {
  const { omdbApiKey } = await chrome.storage.sync.get("omdbApiKey");
  return omdbApiKey || "";
}

async function getCached(title) {
  const key = "rating:" + title.toLowerCase();
  const obj = await chrome.storage.local.get(key);
  const entry = obj[key];
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) return null;
  return entry.v;
}

async function setCached(title, value) {
  const key = "rating:" + title.toLowerCase();
  await chrome.storage.local.set({ [key]: { t: Date.now(), v: value } });
}

async function fetchRating(title) {
  const cached = await getCached(title);
  if (cached) return cached;

  const apiKey = await getApiKey();
  if (!apiKey) return { error: "NO_KEY" };

  try {
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const data = await res.json();
    let result;
    if (data && data.Response === "True") {
      result = {
        title: data.Title,
        year: data.Year,
        rating: data.imdbRating,
        votes: data.imdbVotes,
        imdbID: data.imdbID,
        type: data.Type,
      };
    } else {
      result = { error: "NOT_FOUND" };
    }
    await setCached(title, result);
    return result;
  } catch (e) {
    return { error: "NETWORK" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "GET_RATING" && msg.title) {
    fetchRating(msg.title).then(sendResponse);
    return true;
  }
});