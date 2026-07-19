function ensureBackendFoundation_() {
  if (isBackendFoundationEnsured_()) {
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);

  ensureAircraftBatchColumn_(aircraftSheet);
  ensureAircraftStatusValidation_(aircraftSheet);
  getBatchesSheet_(spreadsheet);
  getSystemLogSheet_(spreadsheet);
  getBackupsSheet_(spreadsheet);
  ensureSecurityFoundation_(spreadsheet);

  markBackendFoundationEnsured_();
}


function isBackendFoundationEnsured_() {
  const properties = PropertiesService.getScriptProperties();
  const storedVersion = properties.getProperty(FOUNDATION_CHECK_PROPERTY);

  if (storedVersion !== BACKEND_FOUNDATION_VERSION) {
    return false;
  }

  const storedTimestamp = Number(
    properties.getProperty(FOUNDATION_CHECK_TIMESTAMP_PROPERTY) || 0
  );

  return (Date.now() - storedTimestamp) < FOUNDATION_CHECK_TTL_MS;
}


function markBackendFoundationEnsured_() {
  const properties = PropertiesService.getScriptProperties();

  properties.setProperty(FOUNDATION_CHECK_PROPERTY, BACKEND_FOUNDATION_VERSION);
  properties.setProperty(
    FOUNDATION_CHECK_TIMESTAMP_PROPERTY,
    String(Date.now())
  );
}


function resetBackendFoundationCache_() {
  const properties = PropertiesService.getScriptProperties();

  properties.deleteProperty(FOUNDATION_CHECK_PROPERTY);
  properties.deleteProperty(FOUNDATION_CHECK_TIMESTAMP_PROPERTY);
}


function ensureAircraftStatusValidation_(sheet) {
  const firstDataRow = 2;
  const buffer = 200; // запас під майбутні нові борти
  const numberOfRows = Math.max(
    (sheet.getLastRow() - firstDataRow + 1) + buffer,
    1
  );

  const validation = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(ALLOWED_STATUSES, true)
    .setAllowInvalid(false)
    .setHelpText("Вибери статус зі списку")
    .build();

  sheet
    .getRange(
      firstDataRow,
      AIRCRAFT_COLUMNS.STATUS,
      numberOfRows,
      1
    )
    .setDataValidation(validation);
}


function ensureAircraftBatchColumn_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), AIRCRAFT_COLUMNS.COMMENT);
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (value) {
      return String(value || "").trim();
    });

  const batchColumnIndex = headers.findIndex(function (header) {
    return header.toUpperCase() === "BATCHID";
  });

  if (batchColumnIndex >= 0) {
    if (batchColumnIndex + 1 !== AIRCRAFT_COLUMNS.BATCH_ID) {
      throw new Error(
        "Колонка BatchID у Aircraft має бути восьмою колонкою"
      );
    }

    return;
  }

  sheet
    .getRange(1, AIRCRAFT_COLUMNS.BATCH_ID)
    .setValue("BatchID");
}


function getBatchesSheet_(spreadsheet) {
  return getOrCreateSheetSafe_(
    spreadsheet,
    BATCHES_SHEET,
    BATCH_HEADERS
  ).sheet;
}


function getSystemLogSheet_(spreadsheet) {
  return getOrCreateSheetSafe_(
    spreadsheet,
    SYSTEM_LOG_SHEET,
    SYSTEM_LOG_HEADERS
  ).sheet;
}


function getBackupsSheet_(spreadsheet) {
  return getOrCreateSheetSafe_(
    spreadsheet,
    BACKUPS_SHEET,
    BACKUP_HEADERS
  ).sheet;
}


function getOrCreateSheetSafe_(spreadsheet, sheetName, headers) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(sheetName);
  let created = false;

  if (!sheet) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      // Подвійна перевірка: поки ми чекали на блокування, паралельний
      // запит міг уже створити цей аркуш — тоді просто використовуємо його.
      sheet = book.getSheetByName(sheetName);

      if (!sheet) {
        sheet = book.insertSheet(sheetName);
        created = true;
      }
    } finally {
      lock.releaseLock();
    }
  }

  ensureHeaderRow_(sheet, headers);

  return {
    sheet: sheet,
    created: created
  };
}


function ensureHeaderRow_(sheet, expectedHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders]);

    return;
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .getValues()[0];

  const headerRowIsEmpty = currentHeaders.every(function (value) {
    return !String(value || "").trim();
  });

  if (headerRowIsEmpty) {
    sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders]);
  }
}


function logSystemEvent_(level, action, message, details) {
  try {
    const sheet = getSystemLogSheet_();
    const nextRow = sheet.getLastRow() + 1;

    sheet
      .getRange(nextRow, 1, 1, SYSTEM_LOG_HEADERS.length)
      .setValues([[
        new Date(),
        String(level || "INFO"),
        String(action || ""),
        String(message || ""),
        stringifyLogDetails_(details)
      ]]);
  } catch (loggingError) {
    console.error("SystemLog error:", loggingError);
  }
}


function ensureSecurityFoundation_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const usersResult = getOrCreateSecuritySheet_(
    book,
    USERS_SHEET,
    USER_HEADERS
  );

  ensureUsersPinColumn_(usersResult.sheet);

  const auditResult = getOrCreateSecuritySheet_(
    book,
    AUDIT_LOG_SHEET,
    AUDIT_LOG_HEADERS
  );
  const sessionsResult = getOrCreateSecuritySheet_(
    book,
    SESSIONS_SHEET,
    SESSION_HEADERS
  );

  if (usersResult.created || auditResult.created || sessionsResult.created) {
    appendAuditLog_(
      "",
      "",
      "",
      "SECURITY_FOUNDATION_CREATED",
      "SYSTEM",
      "",
      "SUCCESS",
      {
        usersSheetCreated: usersResult.created,
        auditLogSheetCreated: auditResult.created,
        sessionsSheetCreated: sessionsResult.created
      }
    );
  }

  ensureBootstrapAdmin_(usersResult.sheet);
}


function getOrCreateSecuritySheet_(spreadsheet, sheetName, headers) {
  return getOrCreateSheetSafe_(spreadsheet, sheetName, headers);
}


function getRequiredSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Не знайдено аркуш "' + sheetName + '"');
  }

  return sheet;
}
