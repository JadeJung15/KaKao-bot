(() => {
  const root = document.querySelector("[data-game-pack-help]");
  if (!root) return;
  const topic = root.dataset.gamePackHelp || "";
  fetch(`/api/game-pack-help/${encodeURIComponent(topic)}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.ok) return;
      const commandList = root.querySelector("[data-help-commands]");
      const relatedList = root.querySelector("[data-help-related]");
      if (commandList) {
        commandList.innerHTML = (data.commands || []).map((item) => `<li><code>${item.command}</code><span>${item.description || ""}</span></li>`).join("");
      }
      if (relatedList) {
        relatedList.innerHTML = (data.related || []).map((item) => `<li><code>${item.code}</code><span>${item.title}</span></li>`).join("");
      }
    })
    .catch(() => {});
})();
