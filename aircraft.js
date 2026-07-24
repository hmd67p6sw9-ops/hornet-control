/* Hornet Control v1.5.0-alpha1 */

function loadAircraft(id) {
  showMessage("Завантаження " + id + "…", "info");

  apiRequest({ action: "get", id: id }, function (response) {
    if (!response.ok) {
      showMessage(response.error || "Помилка завантаження", "error");
      scanLocked = false;
      return;
    }

    showAircraft(response.aircraft);
  });
}

function showAircraft(aircraft) {
  currentAircraftData = aircraft;
  selectedAircraftId = aircraft.id;
  currentAircraftStatus = aircraft.status;
  currentStarlinkId = aircraft.starlink || "";

  document.getElementById("aircraftId").textContent = aircraft.id;

  setStatusBadge(aircraft.status);
  setFieldValue("starlink", aircraft.starlink, "Не прив’язаний");
  setFieldValue("serialNumber", aircraft.serialNumber, "Не вказано");
  setFieldValue("receivedDate", aircraft.receivedDate, "Не вказано");
  setFieldValue("lastChange", aircraft.lastChange, "Немає даних");
  setFieldValue("comment", aircraft.comment, "Немає коментаря");

  updateStatusButtons(aircraft.status);

  document.getElementById("scannerCard").classList.add("hidden");
  document.getElementById("aircraftCard").classList.remove("hidden");

  hideMessage();
}

function changeStatus(status) {
  if (!selectedAircraftId) return;

  disableStatusButtons(true);
  showCardMessage("Збереження…", "info");

  apiRequest(
    { action: "update", id: selectedAircraftId, status: status },
    function (response) {
      if (!response.ok) {
        disableStatusButtons(false);
        showCardMessage(response.error || "Помилка збереження", "error");
        return;
      }

      currentAircraftStatus = status;
      setStatusBadge(status);
      updateStatusButtons(status);

      showCardMessage(
        response.result.message || "Статус змінено",
        "success",
      );

      if (navigator.vibrate) navigator.vibrate(150);

      setTimeout(scanAnotherAircraft, 1200);
    },
  );
}

function openWorkshopChoiceModal() {
  if (!selectedAircraftId) return;

  document.getElementById("workshopChoiceModal").classList.remove("hidden");
}

function closeWorkshopChoiceModal() {
  document.getElementById("workshopChoiceModal").classList.add("hidden");
}

function chooseWorkshopStatus(status) {
  closeWorkshopChoiceModal();
  changeStatus(status);
}

function searchAircraftFromApp() {
  const query = document
    .getElementById("aircraftSearchInput")
    .value.trim();
  const container = document.getElementById("aircraftSearchResults");

  if (!query) {
    showGenericMessage(
      "aircraftSearchMessage",
      "Введи ID або серійний номер",
      "error",
    );
    return;
  }

  container.innerHTML = '<div class="no-items">Пошук…</div>';
  hideGenericMessage("aircraftSearchMessage");

  apiRequest(
    { action: "searchAircraft", query: query },
    function (response) {
      if (!response.ok) {
        container.innerHTML = "";
        showGenericMessage(
          "aircraftSearchMessage",
          response.error || "Помилка пошуку",
          "error",
        );
        return;
      }

      renderAircraftSearchResults(response.aircraft || []);
    },
  );
}

function renderAircraftSearchResults(items) {
  const container = document.getElementById("aircraftSearchResults");
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
      (item.status || "Не вказано") +
      (item.serialNumber ? " • " + item.serialNumber : "");

    button.appendChild(title);
    button.appendChild(meta);

    button.addEventListener("click", function () {
      closeAircraftSearchModal();
      showAircraft(item);
    });

    container.appendChild(button);
  });
}

function clearAircraftSearch() {
  document.getElementById("aircraftSearchInput").value = "";
  document.getElementById("aircraftSearchResults").innerHTML = "";
  hideGenericMessage("aircraftSearchMessage");
}

function createAircraftFromApp() {
  const id = document.getElementById("newAircraftId").value.trim();
  const status = document.getElementById("newAircraftStatus").value;
  const serialNumber = document
    .getElementById("newAircraftSerial")
    .value.trim();
  const receivedDate = document.getElementById("newAircraftDate").value;
  const comment = document
    .getElementById("newAircraftComment")
    .value.trim();

  setFormDisabled("createAircraftModal", true);
  showGenericMessage("createAircraftMessage", "Створення борта…", "info");

  apiRequest(
    {
      action: "createAircraft",
      status: status,
      serialNumber: serialNumber,
      receivedDate: receivedDate,
      comment: comment,
    },
    function (response) {
      setFormDisabled("createAircraftModal", false);

      if (!response.ok) {
        showGenericMessage(
          "createAircraftMessage",
          response.error || "Не вдалося створити борт",
          "error",
        );
        return;
      }

      showGenericMessage(
        "createAircraftMessage",
        response.result.message || "Борт створено",
        "success",
      );

      if (navigator.vibrate) navigator.vibrate(150);

      setTimeout(function () {
        const aircraft =
          response.result.aircraft;

        closeCreateAircraftModal();
        showAircraft(aircraft);
        showAircraftQr(aircraft.id);
        refreshQrQueueCount();
      }, 800);
    },
  );
}

function openEditModal() {
  if (!currentAircraftData) return;

  document.getElementById("editSerialNumber").value =
    currentAircraftData.serialNumber || "";

  document.getElementById("editReceivedDate").value =
    displayDateToInputDate(currentAircraftData.receivedDate);

  document.getElementById("editComment").value =
    currentAircraftData.comment || "";

  hideEditMessage();
  document.getElementById("editModal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  hideEditMessage();
  setEditButtonsDisabled(false);
}

function saveAircraftDetails() {
  if (!selectedAircraftId) return;

  const serialNumber = document
    .getElementById("editSerialNumber")
    .value.trim();

  const receivedDate = document.getElementById("editReceivedDate").value;

  const comment = document.getElementById("editComment").value.trim();

  setEditButtonsDisabled(true);
  showEditMessage("Збереження даних…", "info");

  apiRequest(
    {
      action: "updateDetails",
      id: selectedAircraftId,
      serialNumber: serialNumber,
      receivedDate: receivedDate,
      comment: comment,
    },
    function (response) {
      setEditButtonsDisabled(false);

      if (!response.ok) {
        showEditMessage(
          response.error || "Не вдалося зберегти дані",
          "error",
        );
        return;
      }

      if (response.result.aircraft) {
        showAircraft(response.result.aircraft);
      }

      showEditMessage(
        response.result.message || "Дані оновлено",
        "success",
      );

      if (navigator.vibrate) navigator.vibrate(150);

      setTimeout(closeEditModal, 800);
    },
  );
}

function displayDateToInputDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) return "";

  return match[3] + "-" + match[2] + "-" + match[1];
}