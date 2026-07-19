function normalizeHeaderText_(value) {
  return String(value || "")
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}


function isHeaderMatch_(expectedHeader, actualHeader) {
  const allowedValues = HEADER_ALIASES[expectedHeader] || [expectedHeader];
  const normalizedActual = normalizeHeaderText_(actualHeader);

  return allowedValues.some(function (allowedValue) {
    return normalizeHeaderText_(allowedValue) === normalizedActual;
  });
}


function healthCheck() {
  ensureBackendFoundation_();

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const report = {
    ok: true,
    checkedAt: formatDate_(new Date(), "dd.MM.yyyy HH:mm:ss"),
    summary: {
      errors: 0,
      warnings: 0,
      repaired: 0
    },
    sheets: [],
    issues: []
  };

  const sheetDefinitions = [
    {
      name: AIRCRAFT_SHEET,
      headers: AIRCRAFT_HEADERS
    },
    {
      name: HISTORY_SHEET,
      headers: [
        "Timestamp",
        "AircraftID",
        "OldStatus",
        "NewStatus",
        "Comment"
      ]
    },
    {
      name: STARLINKS_SHEET,
      headers: [
        "ID",
        "Status",
        "AircraftID",
        "SerialNumber",
        "Comment"
      ]
    },
    {
      name: QR_QUEUE_SHEET,
      headers: [
        "AircraftID",
        "Created",
        "Printed",
        "PrintedDate"
      ]
    },
    {
      name: SETTINGS_SHEET,
      headers: [
        "Key",
        "Value"
      ]
    },
    {
      name: PRINT_TEMPLATES_SHEET,
      headers: [
        "ID",
        "Name",
        "Type",
        "PageWidth",
        "PageHeight",
        "Columns",
        "Rows",
        "LabelWidth",
        "LabelHeight",
        "MarginLeft",
        "MarginTop",
        "GapX",
        "GapY",
        "QRSize",
        "ShowSerial",
        "Title",
        "IdFontSize",
        "SerialFontSize"
      ]
    },
    {
      name: BATCHES_SHEET,
      headers: BATCH_HEADERS
    },
    {
      name: SYSTEM_LOG_SHEET,
      headers: SYSTEM_LOG_HEADERS
    },
    {
      name: BACKUPS_SHEET,
      headers: BACKUP_HEADERS
    },
    {
      name: USERS_SHEET,
      headers: USER_HEADERS
    },
    {
      name: AUDIT_LOG_SHEET,
      headers: AUDIT_LOG_HEADERS
    },
    {
      name: SESSIONS_SHEET,
      headers: SESSION_HEADERS
    }
  ];

  sheetDefinitions.forEach(function (definition) {
    const sheet = spreadsheet.getSheetByName(definition.name);

    if (!sheet) {
      addHealthIssue_(
        report,
        "ERROR",
        "MISSING_SHEET",
        definition.name,
        'Відсутній аркуш "' + definition.name + '"'
      );

      return;
    }

    const currentHeaders = sheet
      .getRange(1, 1, 1, definition.headers.length)
      .getValues()[0]
      .map(function (value) {
        return String(value || "").trim();
      });

    const mismatches = [];

    definition.headers.forEach(function (expectedHeader, index) {
      if (!isHeaderMatch_(expectedHeader, currentHeaders[index])) {
        mismatches.push({
          column: index + 1,
          expected: expectedHeader,
          actual: currentHeaders[index]
        });
      }
    });

    report.sheets.push({
      name: definition.name,
      rows: Math.max(sheet.getLastRow() - 1, 0),
      columns: sheet.getLastColumn(),
      schemaOk: mismatches.length === 0
    });

    if (mismatches.length) {
      addHealthIssue_(
        report,
        "WARNING",
        "HEADER_MISMATCH",
        definition.name,
        "Структура заголовків відрізняється від очікуваної",
        mismatches
      );
    }
  });

  inspectAircraftIntegrity_(report);
  inspectStarlinkIntegrity_(report);
  inspectQrQueueIntegrity_(report);

  report.ok = report.summary.errors === 0;

  logSystemEvent_(
    report.ok ? "INFO" : "ERROR",
    "HEALTH_CHECK",
    report.ok
      ? "Перевірку цілісності завершено"
      : "Перевірка виявила критичні помилки",
    report.summary
  );

  return report;
}


function addHealthIssue_(
  report,
  severity,
  code,
  source,
  message,
  details
) {
  const normalizedSeverity = String(severity || "WARNING").toUpperCase();

  report.issues.push({
    severity: normalizedSeverity,
    code: String(code || ""),
    source: String(source || ""),
    message: String(message || ""),
    details: details || null
  });

  if (normalizedSeverity === "ERROR") {
    report.summary.errors++;
  } else {
    report.summary.warnings++;
  }
}


function inspectAircraftIntegrity_(report) {
  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues();

  const idRows = {};
  const serialRows = {};
  const validAircraftIds = {};

  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    const rawId = String(row[AIRCRAFT_COLUMNS.ID - 1] || "").trim();
    const id = normalizeAircraftId_(rawId);
    const serial = String(
      row[AIRCRAFT_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    const status = String(
      row[AIRCRAFT_COLUMNS.STATUS - 1] || ""
    ).trim();

    if (rawId && !id) {
      addHealthIssue_(
        report,
        "ERROR",
        "INVALID_AIRCRAFT_ID",
        AIRCRAFT_SHEET,
        "Некоректний ID борта в рядку " + sheetRow,
        {
          row: sheetRow,
          value: rawId
        }
      );
    }

    if (id) {
      validAircraftIds[id] = true;

      if (!idRows[id]) {
        idRows[id] = [];
      }

      idRows[id].push(sheetRow);
    }

    if (serial) {
      if (!serialRows[serial]) {
        serialRows[serial] = [];
      }

      serialRows[serial].push(sheetRow);
    }

    if (status && !ALLOWED_STATUSES.includes(status)) {
      addHealthIssue_(
        report,
        "WARNING",
        "INVALID_AIRCRAFT_STATUS",
        AIRCRAFT_SHEET,
        "Невідомий статус борта в рядку " + sheetRow,
        {
          row: sheetRow,
          value: status
        }
      );
    }
  });

  Object.keys(idRows).forEach(function (id) {
    if (idRows[id].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_AIRCRAFT_ID",
        AIRCRAFT_SHEET,
        "Дублікат ID борта " + id,
        {
          rows: idRows[id]
        }
      );
    }
  });

  Object.keys(serialRows).forEach(function (serial) {
    if (serialRows[serial].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_AIRCRAFT_SERIAL",
        AIRCRAFT_SHEET,
        "Дублікат серійного номера борта " + serial,
        {
          rows: serialRows[serial]
        }
      );
    }
  });

  report._validAircraftIds = validAircraftIds;
}


function inspectStarlinkIntegrity_(report) {
  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, STARLINK_COLUMNS.COMMENT)
    .getValues();

  const idRows = {};
  const serialRows = {};
  const validAircraftIds = report._validAircraftIds || {};

  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    const id = normalizeStarlinkId_(row[STARLINK_COLUMNS.ID - 1]);
    const serial = String(
      row[STARLINK_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    const aircraftId = normalizeAircraftId_(
      row[STARLINK_COLUMNS.AIRCRAFT_ID - 1]
    );

    if (id) {
      if (!idRows[id]) {
        idRows[id] = [];
      }

      idRows[id].push(sheetRow);
    }

    if (serial) {
      if (!serialRows[serial]) {
        serialRows[serial] = [];
      }

      serialRows[serial].push(sheetRow);
    }

    if (aircraftId && !validAircraftIds[aircraftId]) {
      addHealthIssue_(
        report,
        "ERROR",
        "ORPHAN_STARLINK_LINK",
        STARLINKS_SHEET,
        "Starlink прив’язаний до неіснуючого борта " + aircraftId,
        {
          row: sheetRow,
          starlinkId: id,
          aircraftId: aircraftId
        }
      );
    }
  });

  Object.keys(idRows).forEach(function (id) {
    if (idRows[id].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_STARLINK_ID",
        STARLINKS_SHEET,
        "Дублікат ID Starlink " + id,
        {
          rows: idRows[id]
        }
      );
    }
  });

  Object.keys(serialRows).forEach(function (serial) {
    if (serialRows[serial].length > 1) {
      addHealthIssue_(
        report,
        "ERROR",
        "DUPLICATE_STARLINK_SERIAL",
        STARLINKS_SHEET,
        "Дублікат серійного номера Starlink " + serial,
        {
          rows: serialRows[serial]
        }
      );
    }
  });

  delete report._validAircraftIds;
}


function inspectQrQueueIntegrity_(report) {
  const sheet = getQrQueueSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 4)
    .getValues();

  const activeRows = {};

  values.forEach(function (row, index) {
    const sheetRow = index + 2;
    const aircraftId = normalizeAircraftId_(row[0]);
    const printed = normalizeBoolean_(row[2]);

    if (!aircraftId) {
      addHealthIssue_(
        report,
        "WARNING",
        "INVALID_QR_QUEUE_ID",
        QR_QUEUE_SHEET,
        "Некоректний ID у черзі QR",
        {
          row: sheetRow,
          value: row[0]
        }
      );

      return;
    }

    if (!printed) {
      if (!activeRows[aircraftId]) {
        activeRows[aircraftId] = [];
      }

      activeRows[aircraftId].push(sheetRow);
    }
  });

  Object.keys(activeRows).forEach(function (aircraftId) {
    if (activeRows[aircraftId].length > 1) {
      addHealthIssue_(
        report,
        "WARNING",
        "DUPLICATE_ACTIVE_QR",
        QR_QUEUE_SHEET,
        "Борт має кілька активних записів у черзі QR: " + aircraftId,
        {
          rows: activeRows[aircraftId]
        }
      );
    }
  });
}
