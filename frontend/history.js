/* Hornet Control v1.5.0-alpha1 */

function openHistoryModal() {
  if (!selectedAircraftId) return;

  document.getElementById("historyModal").classList.remove("hidden");
  document.getElementById("historyList").innerHTML =
    '<div class="no-items">Завантаження…</div>';

  hideHistoryMessage();

  apiRequest(
    { action: "history", id: selectedAircraftId },
    function (response) {
      if (!response.ok) {
        document.getElementById("historyList").innerHTML = "";
        showHistoryMessage(
          response.error || "Не вдалося завантажити історію",
          "error",
        );
        return;
      }

      renderHistory(response.history || []);
    },
  );
}

function renderHistory(items) {
  const container = document.getElementById("historyList");
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = '<div class="no-items">Історія відсутня</div>';
    return;
  }

  items.forEach(function (item) {
    const block = document.createElement("div");
    block.className = "history-item";

    const time = document.createElement("div");
    time.className = "history-time";
    time.textContent = item.timestamp;

    const main = document.createElement("div");
    main.className = "history-main";

    if (
      item.type === "starlink" ||
      item.type === "details" ||
      item.type === "created"
    ) {
      main.textContent = item.comment || "Подія";
    } else {
      const oldStatus = item.oldStatus || "Не вказано";
      const newStatus = item.newStatus || "Не вказано";

      main.innerHTML =
        escapeHtml(oldStatus) +
        '<span class="history-arrow">→</span>' +
        escapeHtml(newStatus);
    }

    block.appendChild(time);
    block.appendChild(main);

    if (
      item.comment &&
      item.type !== "starlink" &&
      item.type !== "details" &&
      item.type !== "created"
    ) {
      const comment = document.createElement("div");
      comment.className = "history-comment";
      comment.textContent = item.comment;
      block.appendChild(comment);
    }

    container.appendChild(block);
  });
}

function closeHistoryModal() {
  document.getElementById("historyModal").classList.add("hidden");
  hideHistoryMessage();
}
