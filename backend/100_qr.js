function getQrQueue() {
  const queueSheet = getQrQueueSheet_();
  const lastRow = queueSheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const aircraftSheet =
    getRequiredSheet_(AIRCRAFT_SHEET);

  const aircraftLastRow =
    aircraftSheet.getLastRow();

  const serialByAircraftId = {};

  if (aircraftLastRow >= 2) {
    const aircraftValues = aircraftSheet
      .getRange(
        2,
        1,
        aircraftLastRow - 1,
        7
      )
      .getValues();

    aircraftValues.forEach(function (row) {
      const id =
        normalizeAircraftId_(row[0]);

      if (!id) {
        return;
      }

      serialByAircraftId[id] = String(
        row[3] || ""
      ).trim();
    });
  }

  const values = queueSheet
    .getRange(
      2,
      1,
      lastRow - 1,
      4
    )
    .getValues();

  const result = [];

  values.forEach(function (row, index) {
    const id =
      normalizeAircraftId_(row[0]);

    const printed =
      normalizeBoolean_(row[2]);

    if (!id || printed) {
      return;
    }

    result.push({
      row: index + 2,
      id: id,
      serialNumber:
        serialByAircraftId[id] || "",
      created: formatDate_(
        row[1],
        "dd.MM.yyyy HH:mm:ss"
      ),
      printed: false
    });
  });

  return result;
}


function markQrPrinted(ids) {
  const normalizedIds = String(ids || "")
    .split(",")
    .map(function (id) {
      return normalizeAircraftId_(id);
    })
    .filter(function (id) {
      return Boolean(id);
    });

  const uniqueIds = Array.from(
    new Set(normalizedIds)
  );

  if (!uniqueIds.length) {
    throw new Error(
      "Не вибрано QR-коди"
    );
  }

  const sheet = getQrQueueSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      success: true,
      updated: 0,
      message: "Черга порожня"
    };
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      4
    )
    .getValues();

  const now = new Date();
  let updated = 0;

  values.forEach(function (row, index) {
    const id = normalizeAircraftId_(row[0]);
    const printed = normalizeBoolean_(row[2]);

    if (
      printed ||
      !uniqueIds.includes(id)
    ) {
      return;
    }

    const sheetRow = index + 2;

    sheet
      .getRange(sheetRow, 3)
      .setValue(true);

    sheet
      .getRange(sheetRow, 4)
      .setValue(now);

    updated++;
  });

  return {
    success: true,
    updated: updated,
    message:
      "Позначено надрукованими: " +
      updated
  };
}


function appendQrQueue_(
  aircraftId,
  created
) {
  const id = normalizeAircraftId_(
    aircraftId
  );

  if (!id) {
    throw new Error(
      "Некоректний ID для черги QR"
    );
  }

  const sheet = getQrQueueSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        3
      )
      .getValues();

    for (let i = 0; i < values.length; i++) {
      const existingId =
        normalizeAircraftId_(
          values[i][0]
        );

      const printed =
        normalizeBoolean_(
          values[i][2]
        );

      if (
        existingId === id &&
        !printed
      ) {
        return;
      }
    }
  }

  sheet.appendRow([
    id,
    created || new Date(),
    false,
    ""
  ]);
}


function getQrQueueSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      QR_QUEUE_SHEET
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      QR_QUEUE_SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "AircraftID",
      "Created",
      "Printed",
      "PrintedDate"
    ]);
  } else {
    const headers = sheet
      .getRange(1, 1, 1, 4)
      .getValues()[0];

    const empty = headers.every(
      function (value) {
        return !String(value || "").trim();
      }
    );

    if (empty) {
      sheet
        .getRange(1, 1, 1, 4)
        .setValues([[
          "AircraftID",
          "Created",
          "Printed",
          "PrintedDate"
        ]]);
    }
  }

  return sheet;
}


function syncQrQueue() {
  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const queueSheet = getQrQueueSheet_();
  const aircraftIds = [];
  const aircraftLastRow = aircraftSheet.getLastRow();

  if (aircraftLastRow >= 2) {
    aircraftSheet
      .getRange(2, AIRCRAFT_COLUMNS.ID, aircraftLastRow - 1, 1)
      .getValues()
      .forEach(function (row) {
        const id = normalizeAircraftId_(row[0]);
        if (id) aircraftIds.push(id);
      });
  }

  const activeQueueIds = new Set();
  const queueLastRow = queueSheet.getLastRow();

  if (queueLastRow >= 2) {
    queueSheet
      .getRange(2, 1, queueLastRow - 1, 3)
      .getValues()
      .forEach(function (row) {
        const id = normalizeAircraftId_(row[0]);
        const printed = normalizeBoolean_(row[2]);
        if (id && !printed) activeQueueIds.add(id);
      });
  }

  const uniqueAircraftIds = Array.from(new Set(aircraftIds));
  const missingIds = uniqueAircraftIds.filter(function (id) {
    return !activeQueueIds.has(id);
  });

  if (missingIds.length) {
    const now = new Date();
    const rows = missingIds.map(function (id) {
      return [id, now, false, ""];
    });
    queueSheet
      .getRange(queueSheet.getLastRow() + 1, 1, rows.length, 4)
      .setValues(rows);
  }

  return {
    success: true,
    totalAircraft: uniqueAircraftIds.length,
    alreadyQueued: uniqueAircraftIds.length - missingIds.length,
    added: missingIds.length,
    message: "Синхронізацію завершено"
  };
}


function requeueAircraftQr(aircraftId) {
  const id = normalizeAircraftId_(aircraftId);
  if (!id) throw new Error("Некоректний ID борта");

  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  if (!findAircraftRow_(aircraftSheet, id)) {
    throw new Error("Борт " + id + " не знайдено");
  }

  const queueSheet = getQrQueueSheet_();
  const lastRow = queueSheet.getLastRow();

  if (lastRow >= 2) {
    const values = queueSheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < values.length; i++) {
      const existingId = normalizeAircraftId_(values[i][0]);
      const printed = normalizeBoolean_(values[i][2]);
      if (existingId === id && !printed) {
        return {
          success: true,
          unchanged: true,
          message: "QR цього борта вже у черзі"
        };
      }
    }
  }

  const now = new Date();
  queueSheet.appendRow([id, now, false, ""]);
  appendHistory_(now, id, "", "", "QR повторно додано у чергу");

  return {
    success: true,
    unchanged: false,
    message: "QR додано у чергу повторно"
  };
}


function getAircraftQrStatus(aircraftId) {
  const id = normalizeAircraftId_(aircraftId);
  if (!id) throw new Error("Некоректний ID борта");

  const queueSheet = getQrQueueSheet_();
  const lastRow = queueSheet.getLastRow();
  if (lastRow < 2) return {state: "missing", label: "Не створено"};

  const values = queueSheet.getRange(2, 1, lastRow - 1, 4).getValues();
  let hasPrinted = false;

  for (let i = 0; i < values.length; i++) {
    if (normalizeAircraftId_(values[i][0]) !== id) continue;
    if (!normalizeBoolean_(values[i][2])) {
      return {state: "queued", label: "У черзі"};
    }
    hasPrinted = true;
  }

  return hasPrinted
    ? {state: "printed", label: "Надруковано"}
    : {state: "missing", label: "Не створено"};
}

/* =========================
   PRINT SETTINGS
   ========================= */


function getPrintSettings() {
  const sheet = getSettingsSheet_();
  const lastRow = sheet.getLastRow();

  const defaults =
    getDefaultPrintSettings_();

  if (lastRow < 2) {
    return defaults;
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      2
    )
    .getValues();

  const rawSettings = {};

  values.forEach(function (row) {
    const key = String(
      row[0] || ""
    ).trim();

    if (!key) {
      return;
    }

    rawSettings[key] = row[1];
  });

  return {
    printer: String(
      rawSettings.Printer ||
      defaults.printer
    ).trim(),

    labelWidth: numberSetting_(
      rawSettings.LabelWidth,
      defaults.labelWidth,
      20,
      108
    ),

    labelHeight: numberSetting_(
      rawSettings.LabelHeight,
      defaults.labelHeight,
      15,
      150
    ),

    qrSize: numberSetting_(
      rawSettings.QRSize,
      defaults.qrSize,
      10,
      90
    ),

    title: String(
      rawSettings.Title ||
      defaults.title
    ).trim(),

    showSerial: normalizeBooleanSetting_(
      rawSettings.ShowSerial,
      defaults.showSerial
    ),

    idFontSize: numberSetting_(
      rawSettings.IdFontSize,
      defaults.idFontSize,
      6,
      30
    ),

    serialFontSize: numberSetting_(
      rawSettings.SerialFontSize,
      defaults.serialFontSize,
      5,
      20
    ),

    margin: numberSetting_(
      rawSettings.Margin,
      defaults.margin,
      0,
      15
    )
  };
}


function getSettingsSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      SETTINGS_SHEET
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      SETTINGS_SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Key",
      "Value"
    ]);

    const defaults =
      getDefaultPrintSettings_();

    sheet
      .getRange(
        2,
        1,
        9,
        2
      )
      .setValues([
        ["Printer", defaults.printer],
        [
          "LabelWidth",
          defaults.labelWidth
        ],
        [
          "LabelHeight",
          defaults.labelHeight
        ],
        ["QRSize", defaults.qrSize],
        ["Title", defaults.title],
        [
          "ShowSerial",
          defaults.showSerial
        ],
        [
          "IdFontSize",
          defaults.idFontSize
        ],
        [
          "SerialFontSize",
          defaults.serialFontSize
        ],
        ["Margin", defaults.margin]
      ]);
  }

  return sheet;
}


function getDefaultPrintSettings_() {
  return {
    printer: "Xprinter XP-420B",
    labelWidth: 60,
    labelHeight: 40,
    qrSize: 25,
    title: "HORNET",
    showSerial: true,
    idFontSize: 15,
    serialFontSize: 8,
    margin: 2
  };
}


function numberSetting_(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number(value);

  if (!isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number)
  );
}


function normalizeBooleanSetting_(
  value,
  fallback
) {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  const text = String(value || "")
    .trim()
    .toUpperCase();

  if (
    text === "TRUE" ||
    text === "ТАК" ||
    text === "YES" ||
    text === "1"
  ) {
    return true;
  }

  if (
    text === "FALSE" ||
    text === "НІ" ||
    text === "NO" ||
    text === "0"
  ) {
    return false;
  }

  return fallback;
}


/* =========================
   PRINT TEMPLATES
   ========================= */


function getPrintTemplates() {
  const sheet = getPrintTemplatesSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      18
    )
    .getValues();

  return values
    .map(function (row) {
      return {
        id: String(row[0] || "").trim(),
        name: String(row[1] || "").trim(),
        type: String(row[2] || "")
          .trim()
          .toUpperCase(),
        pageWidth: Number(row[3]),
        pageHeight: Number(row[4]),
        columns: Number(row[5]),
        rows: Number(row[6]),
        labelWidth: Number(row[7]),
        labelHeight: Number(row[8]),
        marginLeft: Number(row[9]),
        marginTop: Number(row[10]),
        gapX: Number(row[11]),
        gapY: Number(row[12]),
        qrSize: Number(row[13]),
        showSerial:
          normalizeBooleanSetting_(
            row[14],
            false
          ),
        title: String(row[15] || "").trim(),
        idFontSize: Number(row[16]),
        serialFontSize: Number(row[17])
      };
    })
    .filter(function (template) {
      return (
        template.id &&
        template.name &&
        template.type
      );
    });
}


function getPrintTemplatesSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      PRINT_TEMPLATES_SHEET
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      PRINT_TEMPLATES_SHEET
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
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
    ]);

    sheet
      .getRange(
        2,
        1,
        2,
        18
      )
      .setValues([
        [
          "A4_44",
          "A4 — 44 етикетки 48,5×25,44 мм",
          "SHEET",
          210,
          297,
          4,
          11,
          48.5,
          25.44,
          8,
          8.58,
          0,
          0,
          19,
          false,
          "",
          9,
          6
        ],
        [
          "XP420B_60X40",
          "Xprinter XP-420B — 60×40 мм",
          "ROLL",
          60,
          40,
          1,
          1,
          60,
          40,
          0,
          0,
          0,
          0,
          25,
          true,
          "HORNET",
          15,
          8
        ]
      ]);
  }

  return sheet;
}


/* =========================
   HISTORY
   ========================= */
