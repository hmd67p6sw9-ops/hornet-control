/* Hornet Control v1.5.0-alpha1 */

function openAdminMenu() {
  document.getElementById("adminMenuModal").classList.remove("hidden");
}

function closeAdminMenu() {
  document.getElementById("adminMenuModal").classList.add("hidden");
}

function openAircraftSearchModal() {
  closeAdminMenu();
  clearAircraftSearch();
  document
    .getElementById("aircraftSearchModal")
    .classList.remove("hidden");
}

function closeAircraftSearchModal() {
  document.getElementById("aircraftSearchModal").classList.add("hidden");
}

function openCreateAircraftModal() {
  closeAdminMenu();

  document.getElementById("newAircraftId").value =
    "Завантаження…";

  document.getElementById("newAircraftStatus").value =
    "На складі";

  document.getElementById("newAircraftSerial").value =
    "";

  document.getElementById("newAircraftDate").value =
    "";

  document.getElementById("newAircraftComment").value =
    "";

  hideGenericMessage(
    "createAircraftMessage"
  );

  document
    .getElementById("createAircraftModal")
    .classList.remove("hidden");

  setFormDisabled(
    "createAircraftModal",
    true
  );

  apiRequest(
    {
      action: "nextAircraftId"
    },
    function (response) {
      setFormDisabled(
        "createAircraftModal",
        false
      );

      document.getElementById(
        "newAircraftId"
      ).readOnly = true;

      if (!response.ok) {
        document.getElementById(
          "newAircraftId"
        ).value = "";

        showGenericMessage(
          "createAircraftMessage",
          response.error ||
            "Не вдалося отримати наступний ID",
          "error"
        );

        document.getElementById(
          "createAircraftButton"
        ).disabled = true;

        return;
      }

      document.getElementById(
        "newAircraftId"
      ).value = response.id;

      document.getElementById(
        "createAircraftButton"
      ).disabled = false;
    }
  );
}

function closeCreateAircraftModal() {
  document.getElementById("createAircraftModal").classList.add("hidden");
  setFormDisabled("createAircraftModal", false);
}

function openStarlinkSearchModal() {
  closeAdminMenu();
  clearStarlinkSearch();
  document
    .getElementById("starlinkSearchModal")
    .classList.remove("hidden");
}

function closeStarlinkSearchModal() {
  document.getElementById("starlinkSearchModal").classList.add("hidden");
}

function openCreateStarlinkModal() {
  closeAdminMenu();

  document.getElementById(
    "newStarlinkId"
  ).value = "Завантаження…";

  document.getElementById(
    "newStarlinkSerial"
  ).value = "";

  document.getElementById(
    "newStarlinkComment"
  ).value = "";

  hideGenericMessage(
    "createStarlinkMessage"
  );

  document
    .getElementById(
      "createStarlinkModal"
    )
    .classList.remove("hidden");

  setFormDisabled(
    "createStarlinkModal",
    true
  );

  apiRequest(
    {
      action: "nextStarlinkId"
    },
    function (response) {
      setFormDisabled(
        "createStarlinkModal",
        false
      );

      document.getElementById(
        "newStarlinkId"
      ).readOnly = true;

      if (!response.ok) {
        document.getElementById(
          "newStarlinkId"
        ).value = "";

        showGenericMessage(
          "createStarlinkMessage",
          response.error ||
            "Не вдалося отримати " +
            "наступний ID STARLINK",
          "error"
        );

        document.getElementById(
          "createStarlinkButton"
        ).disabled = true;

        return;
      }

      document.getElementById(
        "newStarlinkId"
      ).value = response.id;

      document.getElementById(
        "createStarlinkButton"
      ).disabled = false;
    }
  );
}

function closeCreateStarlinkModal() {
  document.getElementById("createStarlinkModal").classList.add("hidden");
  setFormDisabled("createStarlinkModal", false);
}

function closeStarlinkInfoModal() {
  document.getElementById("starlinkInfoModal").classList.add("hidden");
}

function closeAllContentModals() {
  [
    "adminMenuModal",
    "aircraftSearchModal",
    "createAircraftModal",
    "starlinkSearchModal",
    "createStarlinkModal",
    "starlinkInfoModal",
    "qrQueueModal",
    "qrModal",
    "starlinkModal",
    "historyModal",
    "editModal",
    "dashboardListModal",
    "batchModal",
  ].forEach(function (id) {
    document.getElementById(id).classList.add("hidden");
  });
}

function setFieldValue(elementId, value, emptyText) {
  const element = document.getElementById(elementId);

  if (value) {
    element.textContent = value;
    element.classList.remove("empty-value");
  } else {
    element.textContent = emptyText;
    element.classList.add("empty-value");
  }
}

function setStatusBadge(status) {
  const element = document.getElementById("currentStatus");

  element.textContent = status || "Не вказано";
  element.className = "status-badge";

  const classes = {
    "На складі": "badge-storage",
    Майстерня: "badge-workshop",
    БГ: "badge-ready",
    Пошкоджено: "badge-damaged",
    Використаний: "badge-written-off",
    Списаний: "badge-written-off",
  };

  element.classList.add(classes[status] || "badge-unknown");
}

function updateStatusButtons(status) {
  document.querySelectorAll(".status-button").forEach(function (button) {
    button.disabled = button.dataset.status === status;
  });
}

function setEditButtonsDisabled(disabled) {
  document
    .querySelectorAll("#editModal button")
    .forEach(function (button) {
      button.disabled = disabled;
    });

  document.getElementById("editSerialNumber").disabled = disabled;
  document.getElementById("editReceivedDate").disabled = disabled;
  document.getElementById("editComment").disabled = disabled;
}

function setFormDisabled(
  modalId,
  disabled
) {
  document
    .querySelectorAll(
      "#" +
        modalId +
        " input, #" +
        modalId +
        " textarea, #" +
        modalId +
        " select, #" +
        modalId +
        " button",
    )
    .forEach(function (element) {
      element.disabled = disabled;
    });

  const aircraftIdInput =
    document.getElementById(
      "newAircraftId",
    );

  if (aircraftIdInput) {
    aircraftIdInput.readOnly = true;
  }

  const starlinkIdInput =
    document.getElementById(
      "newStarlinkId",
    );

  if (starlinkIdInput) {
    starlinkIdInput.readOnly = true;
  }
}

function disableStatusButtons(disabled) {
  document.querySelectorAll(".status-button").forEach(function (button) {
    button.disabled = disabled;
  });
}

function showCardMessage(text, type) {
  let element = document.getElementById("cardMessage");

  if (!element) {
    element = document.createElement("div");
    element.id = "cardMessage";
    document.getElementById("aircraftCard").appendChild(element);
  }

  element.textContent = text;
  element.className = "message " + (type || "info");
}

function showMessage(text, type) {
  const element = document.getElementById("message");
  element.textContent = text;
  element.className = "message " + (type || "info");
  element.classList.remove("hidden");
}

function hideMessage() {
  document.getElementById("message").classList.add("hidden");
}

function showGenericMessage(id, text, type) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = "message " + (type || "info");
  element.classList.remove("hidden");
}

function hideGenericMessage(id) {
  const element = document.getElementById(id);
  element.textContent = "";
  element.className = "message hidden";
}

function showStarlinkMessage(text, type) {
  showGenericMessage("starlinkMessage", text, type);
}

function hideStarlinkMessage() {
  hideGenericMessage("starlinkMessage");
}

function showHistoryMessage(text, type) {
  showGenericMessage("historyMessage", text, type);
}

function hideHistoryMessage() {
  hideGenericMessage("historyMessage");
}

function showEditMessage(text, type) {
  showGenericMessage("editMessage", text, type);
}

function hideEditMessage() {
  hideGenericMessage("editMessage");
}
