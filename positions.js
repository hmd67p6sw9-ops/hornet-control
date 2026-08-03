/* Hornet Control v1.6.3-alpha1 — Positions */

function openPositionChoiceModal() {
  if (!selectedAircraftId) return;

  document.getElementById("positionChoiceOptions").innerHTML =
    '<div class="no-items">Завантаження…</div>';

  hideGenericMessage("positionChoiceMessage");

  document
    .getElementById("positionChoiceModal")
    .classList.remove("hidden");

  apiRequest(
    { action: "listPositions" },
    function (response) {
      if (!response.ok) {
        showGenericMessage(
          "positionChoiceMessage",
          response.error || "Не вдалося завантажити список позицій",
          "error",
        );
        return;
      }

      renderPositionChoices(response.positions || []);
    },
  );
}

function renderPositionChoices(positions) {
  const container = document.getElementById("positionChoiceOptions");
  container.innerHTML = "";

  if (!positions.length) {
    container.innerHTML =
      '<div class="no-items">Немає жодної позиції. Додай у меню «Адміністрування» → «Позиції».</div>';
    return;
  }

  positions.forEach(function (position) {
    const button = document.createElement("button");
    button.className = "secondary";

    if (
      currentAircraftData &&
      currentAircraftData.position === position.name
    ) {
      button.textContent = position.name + " (поточна)";
    } else {
      button.textContent = position.name;
    }

    button.addEventListener("click", function () {
      choosePosition(position.name);
    });

    container.appendChild(button);
  });
}

function closePositionChoiceModal() {
  document
    .getElementById("positionChoiceModal")
    .classList.add("hidden");
}

function choosePosition(positionName) {
  if (!selectedAircraftId) return;

  showGenericMessage(
    "positionChoiceMessage",
    "Збереження…",
    "info",
  );

  apiRequest(
    {
      action: "assignAircraftPosition",
      id: selectedAircraftId,
      position: positionName,
    },
    function (response) {
      if (!response.ok) {
        showGenericMessage(
          "positionChoiceMessage",
          response.error || "Не вдалося призначити позицію",
          "error",
        );
        return;
      }

      showGenericMessage(
        "positionChoiceMessage",
        response.result.message || "Готово",
        "success",
      );

      if (navigator.vibrate) navigator.vibrate(150);

      if (response.result.aircraft) {
        showAircraft(response.result.aircraft);
      }

      setTimeout(closePositionChoiceModal, 800);
    },
  );
}

/* =========================
   АДМІН-КЕРУВАННЯ СПИСКОМ ПОЗИЦІЙ
   ========================= */

function openPositionsAdminModal() {
  closeAdminMenu();

  document.getElementById("newPositionName").value = "";
  hideGenericMessage("positionsAdminMessage");

  document
    .getElementById("positionsAdminModal")
    .classList.remove("hidden");

  loadPositionsAdminList();
}

function closePositionsAdminModal() {
  document
    .getElementById("positionsAdminModal")
    .classList.add("hidden");
}

function loadPositionsAdminList() {
  const container = document.getElementById("positionsAdminList");
  container.innerHTML = '<div class="no-items">Завантаження…</div>';

  apiRequest(
    { action: "listPositions" },
    function (response) {
      if (!response.ok) {
        container.innerHTML = "";
        showGenericMessage(
          "positionsAdminMessage",
          response.error || "Не вдалося завантажити список позицій",
          "error",
        );
        return;
      }

      renderPositionsAdminList(response.positions || []);
    },
  );
}

function renderPositionsAdminList(positions) {
  const container = document.getElementById("positionsAdminList");
  container.innerHTML = "";

  if (!positions.length) {
    container.innerHTML =
      '<div class="no-items">Позицій ще немає</div>';
    return;
  }

  positions.forEach(function (position) {
    const item = document.createElement("div");
    item.className = "result-item";

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = position.name;

    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = "Додано: " + (position.createdAt || "невідомо");

    item.appendChild(title);
    item.appendChild(meta);
    container.appendChild(item);
  });
}

function createPositionFromApp() {
  const name = document.getElementById("newPositionName").value.trim();

  if (!name) {
    showGenericMessage(
      "positionsAdminMessage",
      "Вкажи назву позиції",
      "error",
    );
    return;
  }

  const button = document.getElementById("createPositionButton");
  button.disabled = true;

  showGenericMessage(
    "positionsAdminMessage",
    "Додавання позиції…",
    "info",
  );

  apiRequest(
    { action: "createPosition", name: name },
    function (response) {
      button.disabled = false;

      if (!response.ok) {
        showGenericMessage(
          "positionsAdminMessage",
          response.error || "Не вдалося додати позицію",
          "error",
        );
        return;
      }

      document.getElementById("newPositionName").value = "";

      showGenericMessage(
        "positionsAdminMessage",
        response.result.message || "Позицію додано",
        "success",
      );

      if (navigator.vibrate) navigator.vibrate(150);

      renderPositionsAdminList(response.result.positions || []);
    },
  );
}