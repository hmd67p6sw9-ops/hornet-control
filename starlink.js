/* Hornet Control v1.5.0-alpha1 */

function searchStarlinksFromApp() {
  const query = document
    .getElementById("starlinkSearchInput")
    .value.trim();
  const container = document.getElementById("starlinkSearchResults");

  if (!query) {
    showGenericMessage(
      "starlinkSearchMessage",
      "Введи ID або серійний номер",
      "error",
    );
    return;
  }

  container.innerHTML = '<div class="no-items">Пошук…</div>';
  hideGenericMessage("starlinkSearchMessage");

  apiRequest(
    { action: "searchStarlinks", query: query },
    function (response) {
      if (!response.ok) {
        container.innerHTML = "";
        showGenericMessage(
          "starlinkSearchMessage",
          response.error || "Помилка пошуку",
          "error",
        );
        return;
      }

      renderStarlinkSearchResults(response.starlinks || []);
    },
  );
}

function renderStarlinkSearchResults(items) {
  const container = document.getElementById("starlinkSearchResults");
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML =
      '<div class="no-items">Нічого не знайдено</div>';
    return;
  }

  items.forEach(function (item) {
    const button = document.createElement("button");
    button.className = "result-item";

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = item.id;

    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent =
      (item.status || "Вільний") +
      (item.linkedAircraft ? " • " + item.linkedAircraft : "");

    button.appendChild(title);
    button.appendChild(meta);

    button.addEventListener("click", function () {
      closeStarlinkSearchModal();
      showStarlinkInfo(item);
    });

    container.appendChild(button);
  });
}

function showStarlinkInfo(item) {
  document.getElementById("starlinkInfoId").textContent =
    item.id || "Не вказано";
  document.getElementById("starlinkInfoStatus").textContent =
    item.status || "Вільний";
  setFieldValue(
    "starlinkInfoAircraft",
    item.linkedAircraft,
    "Не прив’язаний",
  );
  setFieldValue("starlinkInfoSerial", item.serialNumber, "Не вказано");
  setFieldValue("starlinkInfoComment", item.comment, "Немає коментаря");
  document.getElementById("starlinkInfoModal").classList.remove("hidden");
}

function clearStarlinkSearch() {
  document.getElementById("starlinkSearchInput").value = "";
  document.getElementById("starlinkSearchResults").innerHTML = "";
  hideGenericMessage("starlinkSearchMessage");
}

function createStarlinkFromApp() {
  const id = document.getElementById("newStarlinkId").value.trim();
  const serialNumber = document
    .getElementById("newStarlinkSerial")
    .value.trim();
  const comment = document
    .getElementById("newStarlinkComment")
    .value.trim();

  setFormDisabled("createStarlinkModal", true);
  showGenericMessage(
    "createStarlinkMessage",
    "Створення STARLINK…",
    "info",
  );

  apiRequest(
    {
      action: "createStarlink",
      serialNumber: serialNumber,
      comment: comment,
    },
    function (response) {
      setFormDisabled("createStarlinkModal", false);

      if (!response.ok) {
        showGenericMessage(
          "createStarlinkMessage",
          response.error || "Не вдалося створити STARLINK",
          "error",
        );
        return;
      }

      showGenericMessage(
        "createStarlinkMessage",
        response.result.message || "STARLINK створено",
        "success",
      );

      if (navigator.vibrate) navigator.vibrate(150);

      setTimeout(function () {
        closeCreateStarlinkModal();
        showStarlinkInfo(response.result.starlink);
      }, 800);
    },
  );
}

function openStarlinkModal() {
  if (!selectedAircraftId) return;

  selectedStarlinkId = currentStarlinkId;

  document.getElementById("starlinkModal").classList.remove("hidden");
  document.getElementById("starlinkOptions").innerHTML =
    '<div class="no-items">Завантаження…</div>';

  hideStarlinkMessage();

  apiRequest(
    { action: "starlinks", id: selectedAircraftId },
    function (response) {
      if (!response.ok) {
        showStarlinkMessage(
          response.error || "Не вдалося завантажити список",
          "error",
        );
        return;
      }

      renderStarlinks(response.starlinks || []);
    },
  );
}

function renderStarlinks(starlinks) {
  const container = document.getElementById("starlinkOptions");
  container.innerHTML = "";

  if (!starlinks.length) {
    container.innerHTML =
      '<div class="no-items">Немає доступних STARLINK</div>';
    return;
  }

  starlinks.forEach(function (item) {
    const label = document.createElement("label");
    label.className =
      "starlink-option" + (item.current ? " current" : "");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "starlinkChoice";
    radio.value = item.id;
    radio.checked = item.id === selectedStarlinkId;

    radio.addEventListener("change", function () {
      selectedStarlinkId = item.id;

      document
        .querySelectorAll(".starlink-option")
        .forEach(function (option) {
          option.classList.remove("current");
        });

      label.classList.add("current");
    });

    const text = document.createElement("span");
    text.className = "starlink-option-text";

    const id = document.createElement("span");
    id.className = "starlink-id";
    id.textContent = item.id;

    const meta = document.createElement("span");
    meta.className = "starlink-meta";
    meta.textContent = item.current
      ? "Зараз встановлений на цьому борту"
      : item.status || "Вільний";

    text.appendChild(id);
    text.appendChild(meta);
    label.appendChild(radio);
    label.appendChild(text);
    container.appendChild(label);
  });
}

function saveStarlinkAssignment() {
  if (!selectedAircraftId) return;

  if (!selectedStarlinkId) {
    showStarlinkMessage("Вибери STARLINK зі списку", "error");
    return;
  }

  setStarlinkModalButtonsDisabled(true);
  showStarlinkMessage("Збереження прив’язки…", "info");
  assignStarlink(selectedStarlinkId);
}

function unlinkStarlink() {
  if (!selectedAircraftId) return;

  if (!currentStarlinkId) {
    showStarlinkMessage("На цьому борту STARLINK не прив’язаний", "info");
    return;
  }

  setStarlinkModalButtonsDisabled(true);
  showStarlinkMessage("Відв’язування…", "info");
  assignStarlink("");
}

function assignStarlink(starlinkId) {
  apiRequest(
    {
      action: "assignStarlink",
      id: selectedAircraftId,
      starlink: starlinkId,
    },
    function (response) {
      setStarlinkModalButtonsDisabled(false);

      if (!response.ok) {
        showStarlinkMessage(
          response.error || "Помилка прив’язки",
          "error",
        );
        return;
      }

      currentStarlinkId = response.result.starlink || "";
      setFieldValue("starlink", currentStarlinkId, "Не прив’язаний");

      if (currentAircraftData)
        currentAircraftData.starlink = currentStarlinkId;

      showStarlinkMessage(response.result.message, "success");

      if (navigator.vibrate) navigator.vibrate(150);

      setTimeout(closeStarlinkModal, 900);
    },
  );
}

function closeStarlinkModal() {
  document.getElementById("starlinkModal").classList.add("hidden");
  selectedStarlinkId = "";
  hideStarlinkMessage();
  setStarlinkModalButtonsDisabled(false);
}

function setStarlinkModalButtonsDisabled(disabled) {
  document
    .querySelectorAll("#starlinkModal button")
    .forEach(function (button) {
      button.disabled = disabled;
    });
}
