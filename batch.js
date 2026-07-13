/* Hornet Control v1.5.0-beta1 */

let createdBatchAircraftIds = [];
let batchSubmitting = false;

function openBatchModal() {
  resetBatchForm();
  document.getElementById("batchModal").classList.remove("hidden");
}

function closeBatchModal() {
  if (batchSubmitting) {
    return;
  }

  document.getElementById("batchModal").classList.add("hidden");
}

function resetBatchForm() {
  batchSubmitting = false;
  createdBatchAircraftIds = [];

  document.getElementById("batchFormStep").classList.remove("hidden");
  document.getElementById("batchResultStep").classList.add("hidden");
  document.getElementById("batchQuantity").value = "";
  document.getElementById("batchStatus").value = "На складі";
  document.getElementById("batchDate").value = getLocalIsoDate(new Date());
  document.getElementById("batchComment").value = "";

  const laterOption = document.querySelector(
    'input[name="batchSerialMode"][value="later"]'
  );

  if (laterOption) {
    laterOption.checked = true;
  }

  document.getElementById("batchSerialInputs").innerHTML = "";
  document.getElementById("batchSerialInputs").classList.add("hidden");
  hideGenericMessage("batchMessage");
  setBatchFormDisabled(false);
}

function getLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

function getBatchSerialMode() {
  const selected = document.querySelector(
    'input[name="batchSerialMode"]:checked'
  );

  return selected ? selected.value : "later";
}

function onBatchSerialModeChange() {
  renderBatchSerialInputs();
}

function renderBatchSerialInputs() {
  const container = document.getElementById("batchSerialInputs");
  const quantity = Number(document.getElementById("batchQuantity").value);
  const mode = getBatchSerialMode();

  if (mode !== "now" || !Number.isInteger(quantity) || quantity < 1) {
    container.innerHTML = "";
    container.classList.add("hidden");
    return;
  }

  if (quantity > 500) {
    container.innerHTML = "";
    container.classList.add("hidden");
    return;
  }

  const existingValues = Array.from(
    container.querySelectorAll(".batch-serial-input")
  ).map(function (input) {
    return input.value;
  });

  container.innerHTML = "";
  container.classList.remove("hidden");

  for (let index = 0; index < quantity; index++) {
    const wrapper = document.createElement("div");
    wrapper.className = "batch-serial-row";

    const label = document.createElement("label");
    label.className = "batch-serial-number";
    label.setAttribute("for", "batchSerial" + index);
    label.textContent = String(index + 1);

    const input = document.createElement("input");
    input.id = "batchSerial" + index;
    input.className = "form-input batch-serial-input";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Серійний номер";
    input.value = existingValues[index] || "";

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }
}

function createBatchFromApp() {
  if (batchSubmitting) {
    return;
  }

  const quantity = Number(document.getElementById("batchQuantity").value);
  const status = document.getElementById("batchStatus").value;
  const createdDate = document.getElementById("batchDate").value;
  const comment = document.getElementById("batchComment").value.trim();

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    showGenericMessage(
      "batchMessage",
      "Вкажи кількість від 1 до 500.",
      "error"
    );
    return;
  }

  if (!createdDate) {
    showGenericMessage("batchMessage", "Вкажи дату отримання.", "error");
    return;
  }

  const serialNumbers = collectBatchSerialNumbers(quantity);

  if (serialNumbers === null) {
    return;
  }

  batchSubmitting = true;
  setBatchFormDisabled(true);
  showGenericMessage("batchMessage", "Створення партії…", "info");

  apiRequest(
    {
      action: "createBatch",
      quantity: quantity,
      status: status,
      createdDate: createdDate,
      comment: comment,
      serialNumbers: JSON.stringify(serialNumbers)
    },
    function (response) {
      batchSubmitting = false;
      setBatchFormDisabled(false);

      if (!response.ok) {
        showGenericMessage(
          "batchMessage",
          response.error || "Не вдалося створити партію",
          "error"
        );
        return;
      }

      showBatchResult(response.result || {});
      refreshDashboard();
      refreshQrQueueCount();

      if (navigator.vibrate) {
        navigator.vibrate(150);
      }
    }
  );
}

function collectBatchSerialNumbers(quantity) {
  if (getBatchSerialMode() !== "now") {
    return [];
  }

  const inputs = Array.from(
    document.querySelectorAll(".batch-serial-input")
  );

  if (inputs.length !== quantity) {
    renderBatchSerialInputs();
    showGenericMessage(
      "batchMessage",
      "Перевір кількість полів серійних номерів.",
      "error"
    );
    return null;
  }

  const values = inputs.map(function (input) {
    return input.value.trim();
  });

  const normalized = values
    .filter(function (value) {
      return Boolean(value);
    })
    .map(function (value) {
      return value.toUpperCase();
    });

  if (new Set(normalized).size !== normalized.length) {
    showGenericMessage(
      "batchMessage",
      "У партії є дублікати серійних номерів.",
      "error"
    );
    return null;
  }

  return values;
}

function setBatchFormDisabled(disabled) {
  document
    .querySelectorAll("#batchFormStep input, #batchFormStep select, #batchFormStep textarea, #batchFormStep button")
    .forEach(function (element) {
      element.disabled = disabled;
    });
}

function showBatchResult(result) {
  createdBatchAircraftIds = Array.isArray(result.aircraftIds)
    ? result.aircraftIds.slice()
    : [];

  document.getElementById("batchResultQuantity").textContent = Number(
    result.quantity || createdBatchAircraftIds.length || 0
  );

  const firstAircraft = result.firstAircraft || createdBatchAircraftIds[0] || "";
  const lastAircraft =
    result.lastAircraft ||
    createdBatchAircraftIds[createdBatchAircraftIds.length - 1] ||
    "";

  document.getElementById("batchResultRange").textContent =
    firstAircraft && lastAircraft
      ? firstAircraft + " — " + lastAircraft
      : "Партію створено";

  document.getElementById("batchFormStep").classList.add("hidden");
  document.getElementById("batchResultStep").classList.remove("hidden");
}

function printCreatedBatchQr() {
  const ids = createdBatchAircraftIds.slice();

  document.getElementById("batchModal").classList.add("hidden");
  openQrQueueModal();
  selectCreatedBatchInQrQueue(ids, 0);
}

function selectCreatedBatchInQrQueue(ids, attempt) {
  const checkboxes = Array.from(
    document.querySelectorAll(".qr-queue-checkbox")
  );

  if (!checkboxes.length && attempt < 40) {
    setTimeout(function () {
      selectCreatedBatchInQrQueue(ids, attempt + 1);
    }, 250);
    return;
  }

  const selectedIds = new Set(ids);

  checkboxes.forEach(function (checkbox) {
    checkbox.checked = selectedIds.has(checkbox.value);
  });
}

function finishBatchAndShowDashboard() {
  document.getElementById("batchModal").classList.add("hidden");
  showDashboard();
}
