/* Hornet Control v1.6.0-beta1 — Smart Search */

let smartSearchItems = [];
let smartSearchFilter = "all";
let smartSearchRunId = 0;

function openSmartSearchModal() {
  closeAdminMenu();
  resetSmartSearch();

  document
    .getElementById("smartSearchModal")
    .classList.remove("hidden");

  setTimeout(function () {
    document.getElementById("smartSearchInput").focus();
  }, 80);
}

function closeSmartSearchModal() {
  document
    .getElementById("smartSearchModal")
    .classList.add("hidden");
}

function resetSmartSearch() {
  smartSearchItems = [];
  smartSearchFilter = "all";

  document.getElementById("smartSearchInput").value = "";
  document.getElementById("smartSearchSummary").textContent = "";
  document.getElementById("smartSearchResults").innerHTML = "";

  hideGenericMessage("smartSearchMessage");
  updateSmartSearchFilterButtons();
  setSmartSearchBusy(false);
}

function runSmartSearch() {
  const input = document.getElementById("smartSearchInput");
  const originalQuery = input.value.trim();

  if (!originalQuery) {
    showGenericMessage(
      "smartSearchMessage",
      "Введи ID, номер або серійний номер",
      "error"
    );
    return;
  }

  const runId = ++smartSearchRunId;
  const queries = buildSmartSearchQueries(originalQuery);

  setSmartSearchBusy(true);
  hideGenericMessage("smartSearchMessage");
  document.getElementById("smartSearchSummary").textContent = "Пошук…";
  document.getElementById("smartSearchResults").innerHTML =
    '<div class="no-items">Завантаження…</div>';

  Promise.all([
    smartSearchApiRequest({
      action: "searchAircraft",
      query: queries.aircraft
    }),
    smartSearchApiRequest({
      action: "searchStarlinks",
      query: queries.starlink
    })
  ])
    .then(function (responses) {
      if (runId !== smartSearchRunId) {
        return;
      }

      const aircraftResponse = responses[0];
      const starlinkResponse = responses[1];
      const errors = [];

      if (!aircraftResponse.ok) {
        errors.push(
          aircraftResponse.error || "Не вдалося виконати пошук бортів"
        );
      }

      if (!starlinkResponse.ok) {
        errors.push(
          starlinkResponse.error || "Не вдалося виконати пошук Starlink"
        );
      }

      smartSearchItems = mergeSmartSearchResults(
        aircraftResponse.aircraft || [],
        starlinkResponse.starlinks || []
      );

      renderSmartSearchResults();

      if (errors.length && !smartSearchItems.length) {
        showGenericMessage(
          "smartSearchMessage",
          errors.join(". "),
          "error"
        );
      } else if (errors.length) {
        showGenericMessage(
          "smartSearchMessage",
          "Частину даних не вдалося завантажити",
          "warning"
        );
      }
    })
    .catch(function (error) {
      if (runId !== smartSearchRunId) {
        return;
      }

      smartSearchItems = [];
      document.getElementById("smartSearchSummary").textContent = "Помилка";
      document.getElementById("smartSearchResults").innerHTML = "";

      showGenericMessage(
        "smartSearchMessage",
        error.message || "Не вдалося виконати пошук",
        "error"
      );
    })
    .finally(function () {
      if (runId === smartSearchRunId) {
        setSmartSearchBusy(false);
      }
    });
}

function smartSearchApiRequest(parameters) {
  return new Promise(function (resolve) {
    apiRequest(parameters, function (response) {
      resolve(response || {
        ok: false,
        error: "Порожня відповідь сервера"
      });
    });
  });
}

function buildSmartSearchQueries(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");

  const digits = normalized.match(/\d+/);
  const number = digits ? Number(digits[0]) : NaN;
  const isAircraftHint = /(HN|HORNET|БОРТ|ХОРНЕТ)/.test(normalized);
  const isStarlinkHint = /(MINI|STARLINK|СТАРЛІНК|СТАРЛИНК)/.test(normalized);
  const onlyNumber = /^\d+$/.test(normalized);

  let aircraftQuery = normalized;
  let starlinkQuery = normalized;

  if (Number.isFinite(number) && (isAircraftHint || onlyNumber)) {
    aircraftQuery = "HN-" + String(number).padStart(4, "0");
  }

  if (Number.isFinite(number) && (isStarlinkHint || onlyNumber)) {
    starlinkQuery = "MINI_" + String(number).padStart(3, "0");
  }

  if (/^HN[-_ ]?\d+$/i.test(normalized)) {
    aircraftQuery = "HN-" + String(number).padStart(4, "0");
  }

  if (/^MINI[-_ ]?\d+$/i.test(normalized)) {
    starlinkQuery = "MINI_" + String(number).padStart(3, "0");
  }

  return {
    aircraft: aircraftQuery,
    starlink: starlinkQuery
  };
}

function mergeSmartSearchResults(aircraftItems, starlinkItems) {
  const result = [];
  const keys = new Set();

  aircraftItems.forEach(function (item) {
    const key = "aircraft:" + String(item.id || "").toUpperCase();

    if (!keys.has(key)) {
      keys.add(key);
      result.push({
        type: "aircraft",
        data: item
      });
    }
  });

  starlinkItems.forEach(function (item) {
    const key = "starlink:" + String(item.id || "").toUpperCase();

    if (!keys.has(key)) {
      keys.add(key);
      result.push({
        type: "starlink",
        data: item
      });
    }
  });

  return result.sort(compareSmartSearchItems);
}

function compareSmartSearchItems(left, right) {
  const leftId = String(left.data.id || "");
  const rightId = String(right.data.id || "");

  if (left.type !== right.type) {
    return left.type === "aircraft" ? -1 : 1;
  }

  return leftId.localeCompare(rightId, "uk", {
    numeric: true,
    sensitivity: "base"
  });
}

function setSmartSearchFilter(filter) {
  smartSearchFilter = filter;
  updateSmartSearchFilterButtons();
  renderSmartSearchResults();
}

function updateSmartSearchFilterButtons() {
  document
    .querySelectorAll(".smart-search-filter")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.filter === smartSearchFilter
      );
    });
}

function renderSmartSearchResults() {
  const container = document.getElementById("smartSearchResults");
  const summary = document.getElementById("smartSearchSummary");
  const visibleItems = smartSearchItems.filter(function (item) {
    return smartSearchFilter === "all" || item.type === smartSearchFilter;
  });

  container.innerHTML = "";
  summary.textContent = "Знайдено: " + visibleItems.length;

  if (!visibleItems.length) {
    container.innerHTML = '<div class="no-items">Нічого не знайдено</div>';
    return;
  }

  let previousType = "";

  visibleItems.forEach(function (item) {
    if (smartSearchFilter === "all" && item.type !== previousType) {
      const groupTitle = document.createElement("div");
      groupTitle.className = "smart-search-group-title";
      groupTitle.textContent = item.type === "aircraft" ? "Борти" : "Starlink";
      container.appendChild(groupTitle);
      previousType = item.type;
    }

    container.appendChild(createSmartSearchResultButton(item));
  });
}

function createSmartSearchResultButton(item) {
  const button = document.createElement("button");
  button.className = "result-item";

  const title = document.createElement("span");
  title.className = "result-title";

  const type = document.createElement("span");
  type.className = "smart-search-type";
  type.textContent = item.type === "aircraft" ? "Борт" : "Starlink";

  const id = document.createTextNode(item.data.id || "Без ID");

  title.appendChild(type);
  title.appendChild(id);

  const meta = document.createElement("span");
  meta.className = "result-meta";
  meta.textContent = item.type === "aircraft"
    ? buildAircraftListMeta(item.data)
    : buildStarlinkListMeta(item.data);

  button.appendChild(title);
  button.appendChild(meta);

  button.addEventListener("click", function () {
    openSmartSearchResult(item);
  });

  return button;
}

function openSmartSearchResult(item) {
  closeSmartSearchModal();

  if (item.type === "aircraft") {
    document.getElementById("dashboardCard").classList.add("hidden");
    showAircraft(item.data);
    return;
  }

  showStarlinkInfo(item.data);
}

function setSmartSearchBusy(busy) {
  document.getElementById("smartSearchButton").disabled = busy;
  document.getElementById("smartSearchInput").disabled = busy;
}

document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("smartSearchInput");

  if (!input) {
    return;
  }

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      runSmartSearch();
    }
  });
});
