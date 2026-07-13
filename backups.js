/* Hornet Control v1.6.0-alpha2 — Backups UI */

let backupsLoading = false;
let backupCreating = false;

function openBackupsModal() {
  closeAdminMenu();

  document
    .getElementById("backupsModal")
    .classList.remove("hidden");

  document.getElementById("backupComment").value = "";
  hideGenericMessage("backupsMessage");
  loadBackups();
}

function closeBackupsModal() {
  document
    .getElementById("backupsModal")
    .classList.add("hidden");
}

function setBackupsControlsDisabled(disabled) {
  document.getElementById("createBackupButton").disabled =
    disabled || backupCreating;

  document.getElementById("refreshBackupsButton").disabled =
    disabled || backupsLoading;

  document.getElementById("backupComment").disabled =
    backupCreating;
}

function createBackupFromApp() {
  if (backupCreating) {
    return;
  }

  const comment = document
    .getElementById("backupComment")
    .value.trim();

  const confirmed = window.confirm(
    "Створити повну резервну копію таблиці Hornet Control?"
  );

  if (!confirmed) {
    return;
  }

  backupCreating = true;
  setBackupsControlsDisabled(true);

  showGenericMessage(
    "backupsMessage",
    "Створення резервної копії… Це може зайняти до хвилини.",
    "info"
  );

  apiRequest(
    {
      action: "createBackup",
      comment: comment
    },
    function (response) {
      backupCreating = false;
      setBackupsControlsDisabled(false);

      if (!response.ok || !response.backup) {
        showGenericMessage(
          "backupsMessage",
          response.error || "Не вдалося створити резервну копію",
          "error"
        );
        return;
      }

      document.getElementById("backupComment").value = "";

      showGenericMessage(
        "backupsMessage",
        response.backup.message || "Резервну копію створено",
        "success"
      );

      if (navigator.vibrate) {
        navigator.vibrate(150);
      }

      loadBackups();
    }
  );
}

function loadBackups() {
  if (backupsLoading) {
    return;
  }

  backupsLoading = true;
  setBackupsControlsDisabled(true);

  document.getElementById("backupsList").innerHTML =
    '<div class="no-items">Завантаження…</div>';

  apiRequest(
    {
      action: "listBackups",
      limit: "30"
    },
    function (response) {
      backupsLoading = false;
      setBackupsControlsDisabled(false);

      if (!response.ok) {
        document.getElementById("backupsList").innerHTML = "";

        showGenericMessage(
          "backupsMessage",
          response.error || "Не вдалося завантажити резервні копії",
          "error"
        );
        return;
      }

      renderBackups(response.backups || []);
    }
  );
}

function renderBackups(backups) {
  const container = document.getElementById("backupsList");
  container.innerHTML = "";

  if (!backups.length) {
    container.innerHTML =
      '<div class="no-items">Резервних копій ще немає</div>';
    return;
  }

  backups.forEach(function (backup) {
    const item = document.createElement("div");
    item.className = "backup-item";

    const header = document.createElement("div");
    header.className = "backup-item-header";

    const id = document.createElement("strong");
    id.className = "backup-id";
    id.textContent = backup.backupId || "Резервна копія";

    const status = document.createElement("span");
    status.className = backup.available
      ? "backup-status backup-status-available"
      : "backup-status backup-status-missing";
    status.textContent = backup.available ? "Доступна" : "Файл відсутній";

    header.appendChild(id);
    header.appendChild(status);

    const date = document.createElement("div");
    date.className = "backup-date";
    date.textContent = backup.createdAt || "Дата не вказана";

    item.appendChild(header);
    item.appendChild(date);

    if (backup.comment) {
      const comment = document.createElement("div");
      comment.className = "backup-comment";
      comment.textContent = backup.comment;
      item.appendChild(comment);
    }

    if (backup.available && backup.url) {
      const openButton = document.createElement("button");
      openButton.className = "secondary backup-open-button";
      openButton.textContent = "Відкрити в Google Drive";
      openButton.addEventListener("click", function () {
        openBackupInDrive(backup.url);
      });
      item.appendChild(openButton);
    }

    container.appendChild(item);
  });
}

function openBackupInDrive(url) {
  const safeUrl = String(url || "").trim();

  if (!/^https:\/\//i.test(safeUrl)) {
    showGenericMessage(
      "backupsMessage",
      "Некоректне посилання на резервну копію",
      "error"
    );
    return;
  }

  const openedWindow = window.open(
    safeUrl,
    "_blank",
    "noopener,noreferrer"
  );

  if (!openedWindow) {
    showGenericMessage(
      "backupsMessage",
      "Браузер заблокував відкриття Google Drive. Дозволь відкриття нових вікон.",
      "warning"
    );
  }
}
