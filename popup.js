const input = document.getElementById("key");
const status = document.getElementById("status");
chrome.storage.sync.get("omdbApiKey", ({ omdbApiKey }) => {
  if (omdbApiKey) input.value = omdbApiKey;
});
document.getElementById("save").addEventListener("click", () => {
  const v = input.value.trim();
  chrome.storage.sync.set({ omdbApiKey: v }, () => {
    status.textContent = v ? "Saved ✓" : "Cleared";
    setTimeout(() => (status.textContent = ""), 1500);
  });
});