/* Hornet Control v1.6.0-alpha1 — System Diagnostics */

let lastHealthReport = null;

function openDiagnosticsModal() {
  closeAdminMenu();

  document
    .getElementById("diagnosticsModal")
    .classList.remove("hidden");

  resetDiagnosticsView();
  runSystemDiagnostics();
}

function closeDiagnosticsModal() {
  document
    .getElementById("diagnosticsModal")
    .classList.add("hidden");
}

function resetDiagnosticsView() {
  lastHealthReport = null;

  document.getElementById("diagnosticsStatus").className =
    "diagnostics-status diagnostics-loading";

  document.getElementById("diagnosticsStatus").textContent =
    "Перевірка системи…";

  document.getElementById("diagnosticsCheckedAt").textContent = "";
  document.getElementById("diagnosticsSummary").innerHTML = "";
  document.getElementById("diagnosticsSheets").innerHTML = "";
  document.getElementById("diagnosticsIssues").innerHTML = "";

  hideGenericMessage("diagnosticsMessage");
}

function runSystemDiagnostics() {
  const runButton = document.getElementById("runDiagnosticsButton");

  runButton.disabled = true;

  document.getElementById("diagnosticsStatus").className =
    "diagnostics-status diagnostics-loading";

  document.getElementById("diagnosticsStatus").textContent =
    "Перевірка системи…";

  hideGenericMessage("diagnosticsMessage");

  apiRequest(
    {
      action: "healthCheck"
    },
    function (response) {
      runButton.disabled = false;

      if (!response.ok || !response.health) {
        document.getElementById("diagnosticsStatus").className =
          "diagnostics-status diagnostics-error";

        document.getElementById("diagnosticsStatus").textContent =
          "Перевірку не виконано";

        showGenericMessage(
          "diagnosticsMessage",
          response.error || "Backend не повернув результат діагностики",
          "error"
        );

        return;
      }

      lastHealthReport = response.health;
      renderDiagnosticsReport(lastHealthReport);
    }
  );
}

function renderDiagnosticsReport(report) {
  const statusElement = document.getElementById("diagnosticsStatus");

  if (report.ok) {
    statusElement.className =
      "diagnostics-status diagnostics-success";
    statusElement.textContent = "Система працює нормально";
  } else {
    statusElement.className =
      "diagnostics-status diagnostics-error";
    statusElement.textContent = "Виявлено критичні помилки";
  }

  document.getElementById("diagnosticsCheckedAt").textContent =
    report.checkedAt ? "Перевірено: " + report.checkedAt : "";

  renderDiagnosticsSummary(report.summary || {});
  renderDiagnosticsSheets(report.sheets || []);
  renderDiagnosticsIssues(report.issues || []);
}

function renderDiagnosticsSummary(summary) {
  const container = document.getElementById("diagnosticsSummary");

  container.innerHTML = "";

  const items = [
    {
      label: "Помилки",
      value: Number(summary.errors || 0),
      className: "diagnostics-count-error"
    },
    {
      label: "Попередження",
      value: Number(summary.warnings || 0),
      className: "diagnostics-count-warning"
    },
    {
      label: "Виправлено",
      value: Number(summary.repaired || 0),
      className: "diagnostics-count-success"
    }
  ];

  items.forEach(function (item) {
    const card = document.createElement("div");
    card.className = "diagnostics-summary-card " + item.className;

    const value = document.createElement("strong");
    value.textContent = item.value;

    const label = document.createElement("span");
    label.textContent = item.label;

    card.appendChild(value);
    card.appendChild(label);
    container.appendChild(card);
  });
}

function renderDiagnosticsSheets(sheets) {
  const container = document.getElementById("diagnosticsSheets");

  container.innerHTML = "";

  if (!sheets.length) {
    container.innerHTML =
      '<div class="no-items">Немає даних про аркуші</div>';
    return;
  }

  sheets.forEach(function (sheet) {
    const row = document.createElement("div");
    row.className = "diagnostics-sheet-row";

    const main = document.createElement("div");
    main.className = "diagnostics-sheet-main";

    const name = document.createElement("strong");
    name.textContent = sheet.name || "Невідомий аркуш";

    const meta = document.createElement("span");
    meta.textContent =
      Number(sheet.rows || 0) +
      " записів • " +
      Number(sheet.columns || 0) +
      " колонок";

    const badge = document.createElement("span");
    badge.className = sheet.schemaOk
      ? "diagnostics-badge diagnostics-badge-ok"
      : "diagnostics-badge diagnostics-badge-warning";
    badge.textContent = sheet.schemaOk ? "OK" : "Структура";

    main.appendChild(name);
    main.appendChild(meta);
    row.appendChild(main);
    row.appendChild(badge);
    container.appendChild(row);
  });
}

function renderDiagnosticsIssues(issues) {
  const container = document.getElementById("diagnosticsIssues");

  container.innerHTML = "";

  if (!issues.length) {
    container.innerHTML =
      '<div class="diagnostics-empty-success">Проблем не виявлено</div>';
    return;
  }

  issues.forEach(function (issue) {
    const item = document.createElement("div");
    const severity = String(issue.severity || "WARNING").toUpperCase();

    item.className =
      "diagnostics-issue " +
      (severity === "ERROR"
        ? "diagnostics-issue-error"
        : "diagnostics-issue-warning");

    const header = document.createElement("div");
    header.className = "diagnostics-issue-header";

    const severityBadge = document.createElement("span");
    severityBadge.className = "diagnostics-issue-severity";
    severityBadge.textContent =
      severity === "ERROR" ? "Помилка" : "Попередження";

    const code = document.createElement("span");
    code.className = "diagnostics-issue-code";
    code.textContent = issue.code || "UNKNOWN";

    const message = document.createElement("div");
    message.className = "diagnostics-issue-message";
    message.textContent = issue.message || "Проблема без опису";

    const source = document.createElement("div");
    source.className = "diagnostics-issue-source";
    source.textContent = issue.source
      ? "Джерело: " + issue.source
      : "";

    header.appendChild(severityBadge);
    header.appendChild(code);
    item.appendChild(header);
    item.appendChild(message);

    if (issue.source) {
      item.appendChild(source);
    }

    if (issue.details) {
      const details = document.createElement("details");
      details.className = "diagnostics-details";

      const summary = document.createElement("summary");
      summary.textContent = "Технічні деталі";

      const pre = document.createElement("pre");
      pre.textContent = formatDiagnosticsDetails(issue.details);

      details.appendChild(summary);
      details.appendChild(pre);
      item.appendChild(details);
    }

    container.appendChild(item);
  });
}

function formatDiagnosticsDetails(details) {
  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch (error) {
    return String(details);
  }
}
