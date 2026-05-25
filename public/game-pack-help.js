(() => {
  const root = document.querySelector("[data-game-pack-help]");
  if (!root) return;
  const topic = root.dataset.gamePackHelp || "";
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }
  fetch(`/api/game-pack-help/${encodeURIComponent(topic)}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.ok) return;
      const commandList = root.querySelector("[data-help-commands]");
      const relatedList = root.querySelector("[data-help-related]");
      if (commandList) {
        commandList.classList.add("help-command-list");
        commandList.innerHTML = (data.commands || []).map((item) => `<li><code>${escapeHtml(item.command)}</code><span>${escapeHtml(item.description || "")}</span></li>`).join("");
      }
      if (relatedList) {
        relatedList.classList.add("help-command-list");
        relatedList.innerHTML = (data.related || []).map((item) => `<li><code>${escapeHtml(item.code)}</code><span>${escapeHtml(item.title)}</span></li>`).join("");
      }
    })
    .catch(() => {});
})();
