/* Hornet Control v1.5.0-alpha2 */

let dashboardLoading = false;

function initializeDashboard() {
  showDashboard();
}

async function showDashboard() {
  await stopScanner();
  closeAllContentModals();

  removeCardMessage();

  document.getElementById("scannerCard").classList.add("hidden");
  document.getElementById("aircraftCard").classList.add("hidden");
  document.getElementById("dashboardCard").classList.remove("hidden");

  refreshDashboard();
}

function refreshDashboard() {
  if (dashboardLoading) {
    return;
  }

  dashboardLoading = true;
  setDashboardLoading(true);
  hideGenericMessage("dashboardMessage");

  apiRequest(
    {
      action: "dashboard"
    },
    function (response) {
      dashboardLoading = false;
      setDashboardLoading(false);

      if (!response.ok) {
        showGenericMessage(
          "dashboardMessage",
          response.error || "Не вдалося завантажити Dashboard",
          "error"
        );
        return;
      }

      renderDashboard(response.dashboard || {});
    }
  );
}

function renderDashboard(data) {
  const aircraft = data.Aircraft || {};
  const starlink = data.Starlink || {};
  const qr = data.QR || {};

  setDashboardCount("dashboardAircraftActive", aircraft.Active);
  setDashboardCount("dashboardAircraftWarehouse", aircraft.Warehouse);
  setDashboardCount("dashboardAircraftReady", aircraft.Ready);
  setDashboardCount("dashboardAircraftRepair", aircraft.Repair);
  setDashboardCount("dashboardAircraftRefurbish", aircraft.Refurbish);
  setDashboardCount("dashboardAircraftDamaged", aircraft.Damaged);
  setDashboardCount("dashboardAircraftUsed", aircraft.Used);

  setDashboardCount("dashboardStarlinkFree", starlink.Free);
  setDashboardCount("dashboardStarlinkAssigned", starlink.Assigned);
  setDashboardCount("dashboardStarlinkBroken", starlink.Broken);
  setDashboardCount("dashboardStarlinkLost", starlink.Lost);

  setDashboardCount("dashboardQrQueued", qr.Queued);

  document.getElementById("dashboardUpdated").textContent =
    "Оновлено " + formatDashboardTime(new Date());

  const menuCount = document.getElementById("qrQueueMenuCount");
  const queued = Number(qr.Queued || 0);

  if (menuCount) {
    menuCount.textContent = queued > 0 ? " (" + queued + ")" : "";
  }
}

function setDashboardCount(elementId, value) {
  document.getElementById(elementId).textContent = Number(value || 0);
}

function setDashboardLoading(loading) {
  const button = document.getElementById("dashboardRefreshButton");

  if (button) {
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
  }
}

function formatDashboardTime(date) {
  return date.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function openAircraftStatusList(status, title) {
  openDashboardListModal(title);

  apiRequest(
    {
      action: "listAircraftByStatus",
      status: status
    },
    function (response) {
      if (!response.ok) {
        showDashboardListError(
          response.error || "Не вдалося завантажити список бортів"
        );
        return;
      }

      renderDashboardAircraftList(response.aircraft || []);
    }
  );
}

function openStarlinkStatusList(status, title) {
  openDashboardListModal(title);

  apiRequest(
    {
      action: "listStarlinksByStatus",
      status: status
    },
    function (response) {
      if (!response.ok) {
        showDashboardListError(
          response.error || "Не вдалося завантажити список Starlink"
        );
        return;
      }

      renderDashboardStarlinkList(response.starlinks || []);
    }
  );
}

function openDashboardListModal(title) {
  document.getElementById("dashboardListTitle").textContent = title;
  document.getElementById("dashboardListSummary").textContent =
    "Завантаження…";
  document.getElementById("dashboardListContent").innerHTML =
    '<div class="no-items">Завантаження…</div>';

  hideGenericMessage("dashboardListMessage");

  document
    .getElementById("dashboardListModal")
    .classList.remove("hidden");
}

function closeDashboardListModal() {
  document
    .getElementById("dashboardListModal")
    .classList.add("hidden");
}

function renderDashboardAircraftList(items) {
  const container = document.getElementById("dashboardListContent");
  const summary = document.getElementById("dashboardListSummary");

  summary.textContent = "Знайдено: " + items.length;
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = '<div class="no-items">Список порожній</div>';
    return;
  }

  items.forEach(function (item) {
    const button = document.createElement("button");
    button.className = "result-item dashboard-list-item";

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = item.id || "Без ID";

    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = buildAircraftListMeta(item);

    button.appendChild(title);
    button.appendChild(meta);

    button.addEventListener("click", function () {
      closeDashboardListModal();
      document.getElementById("dashboardCard").classList.add("hidden");
      showAircraft(item);
    });

    container.appendChild(button);
  });
}

function renderDashboardStarlinkList(items) {
  const container = document.getElementById("dashboardListContent");
  const summary = document.getElementById("dashboardListSummary");

  summary.textContent = "Знайдено: " + items.length;
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = '<div class="no-items">Список порожній</div>';
    return;
  }

  items.forEach(function (item) {
    const button = document.createElement("button");
    button.className = "result-item dashboard-list-item";

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = item.id || "Без ID";

    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = buildStarlinkListMeta(item);

    button.appendChild(title);
    button.appendChild(meta);

    button.addEventListener("click", function () {
      closeDashboardListModal();
      showStarlinkInfo(item);
    });

    container.appendChild(button);
  });
}

function buildAircraftListMeta(item) {
  const parts = [item.status || "Статус не вказано"];

  if (item.serialNumber) {
    parts.push(item.serialNumber);
  }

  if (item.starlink) {
    parts.push(item.starlink);
  }

  return parts.join(" • ");
}

function buildStarlinkListMeta(item) {
  const parts = [item.status || "Вільний"];

  if (item.linkedAircraft) {
    parts.push(item.linkedAircraft);
  }

  if (item.serialNumber) {
    parts.push(item.serialNumber);
  }

  return parts.join(" • ");
}

function showDashboardListError(message) {
  document.getElementById("dashboardListSummary").textContent = "Помилка";
  document.getElementById("dashboardListContent").innerHTML = "";
  showGenericMessage("dashboardListMessage", message, "error");
}

function openQrQueueFromDashboard() {
  openQrQueueModal();
}

function showBatchComingSoon() {
  showGenericMessage(
    "dashboardMessage",
    "Створення партії буде додано у v1.5.0-beta1.",
    "info"
  );
}

function removeCardMessage() {
  const cardMessage = document.getElementById("cardMessage");

  if (cardMessage) {
    cardMessage.remove();
  }
}