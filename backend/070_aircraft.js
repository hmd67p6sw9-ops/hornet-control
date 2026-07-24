function listAircraftByStatus(status) {
  ensureBackendFoundation_();

  const normalizedStatus = String(status || "").trim();

  if (!normalizedStatus) {
    throw new Error("Не вказано статус борта");
  }

  const acceptedStatus = normalizeAircraftStatusFilter_(normalizedStatus);
  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues();

  return values
    .map(function (row, index) {
      return aircraftFromValues_(row, index + 2);
    })
    .filter(function (aircraft) {
      return aircraftStatusMatchesFilter_(
        aircraft.status,
        acceptedStatus
      );
    });
}


function normalizeAircraftStatusFilter_(status) {
  const aliases = {
    ACTIVE: "Активний",
    "АКТИВНІ": "Активний",
    "АКТИВНИЙ": "Активний",
    WAREHOUSE: "На складі",
    "НА СКЛАДІ": "На складі",
    REPAIR: "На ремонті",
    "НА РЕМОНТІ": "На ремонті",
    REFURBISH: "На переробці на БГ",
    "НА ПЕРЕРОБЦІ НА БГ": "На переробці на БГ",
    READY: "На позиції",
    "НА ПОЗИЦІЇ": "На позиції",
    DAMAGED: "Пошкоджено",
    "ПОШКОДЖЕНО": "Пошкоджено",
    USED: "Використаний",
    "ВИКОРИСТАНІ": "Використаний",
    "ВИКОРИСТАНИЙ": "Використаний"
  };

  const key = String(status || "").trim().toUpperCase();
  const normalized = aliases[key] || String(status || "").trim();

  if (!ALLOWED_STATUSES.includes(normalized)) {
    throw new Error("Некоректний статус борта");
  }

  return normalized;
}


function aircraftStatusMatchesFilter_(status, filterStatus) {
  const current = String(status || "").trim();

  if (filterStatus === "Використаний") {
    return current === "Використаний" || current === "Списаний";
  }

  return current === filterStatus;
}


function getAircraft(id) {
  const normalizedId = normalizeAircraftId_(id);

  if (!normalizedId) {
    throw new Error("Введіть ID борта");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  return aircraftFromRow_(sheet, row);
}


function searchAircraft(query) {
  const text = String(query || "").trim().toUpperCase();

  if (!text) {
    throw new Error("Введіть ID або серійний номер");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues();
  const result = [];

  values.forEach(function (row, index) {
    const id = String(row[0] || "").trim().toUpperCase();
    const serial = String(row[3] || "").trim().toUpperCase();

    if (id.includes(text) || serial.includes(text)) {
      result.push({
        row: index + 2,
        id: String(row[0] || ""),
        status: String(row[1] || "Не вказано"),
        starlink: String(row[2] || ""),
        serialNumber: String(row[3] || ""),
        receivedDate: formatDate_(row[4], "dd.MM.yyyy"),
        lastChange: formatDate_(row[5], "dd.MM.yyyy HH:mm:ss"),
        comment: String(row[6] || "")
      });
    }
  });

  return result.slice(0, 25);
}


function getNextAircraftId() {
  const sheet =
    getRequiredSheet_(AIRCRAFT_SHEET);

  return getNextAircraftIdFromSheet_(sheet);
}


function createAircraft(
  status,
  serialNumber,
  receivedDate,
  comment
) {
  const normalizedStatus = String(
    status || "На складі"
  ).trim();

  const normalizedSerialNumber = String(
    serialNumber || ""
  ).trim();

  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    throw new Error("Некоректний статус");
  }

  const parsedReceivedDate =
    parseReceivedDate_(receivedDate);

  const lock = LockService.getDocumentLock();

  lock.waitLock(20000);

  try {
    const sheet =
      getRequiredSheet_(AIRCRAFT_SHEET);

    const newAircraftId =
      getNextAircraftIdFromSheet_(sheet);

    if (normalizedSerialNumber) {
      const duplicateSerialRow =
        findAircraftRowBySerial_(
          sheet,
          normalizedSerialNumber
        );

      if (duplicateSerialRow) {
        const existingAircraftId = String(
          sheet
            .getRange(
              duplicateSerialRow,
              AIRCRAFT_COLUMNS.ID
            )
            .getValue() || ""
        ).trim();

        throw new Error(
          "Серійний номер " +
          normalizedSerialNumber +
          " уже використовується бортом " +
          existingAircraftId
        );
      }
    }

    const now = new Date();

    sheet.appendRow([
      newAircraftId,
      normalizedStatus,
      "",
      normalizedSerialNumber,
      parsedReceivedDate || "",
      now,
      String(comment || "").trim(),
      ""
    ]);

    appendHistory_(
      now,
      newAircraftId,
      "",
      normalizedStatus,
      "СТВОРЕНО БОРТ"
    );

    appendQrQueue_(
      newAircraftId,
      now
    );

    return {
      success: true,
      message: "Борт додано",
      aircraft: getAircraft(newAircraftId)
    };
  } finally {
    lock.releaseLock();
  }
}


function updateAircraftStatus(id, newStatus) {
  const normalizedId = normalizeAircraftId_(id);
  const normalizedStatus = String(newStatus || "").trim();

  if (!normalizedId) {
    throw new Error("Не вказано ID борта");
  }

  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    throw new Error("Некоректний статус");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  const oldStatus = String(
    sheet.getRange(row, AIRCRAFT_COLUMNS.STATUS).getValue() || ""
  ).trim();

  if (oldStatus === normalizedStatus) {
    return {
      success: true,
      unchanged: true,
      message: "Цей статус уже встановлений",
      status: normalizedStatus
    };
  }

  const now = new Date();

  sheet.getRange(row, AIRCRAFT_COLUMNS.STATUS).setValue(normalizedStatus);
  sheet.getRange(row, AIRCRAFT_COLUMNS.LAST_CHANGE).setValue(now);

  appendHistory_(now, normalizedId, oldStatus, normalizedStatus, "");

  if (normalizedStatus === "Використаний") {
    markLinkedStarlinkLost_(sheet, row);
  }

  return {
    success: true,
    unchanged: false,
    message: "Статус оновлено",
    status: normalizedStatus,
    lastChange: formatDate_(now, "dd.MM.yyyy HH:mm:ss")
  };
}


function updateAircraftDetails(
  id,
  serialNumber,
  receivedDate,
  comment
) {
  const normalizedId = normalizeAircraftId_(id);

  if (!normalizedId) {
    throw new Error("Не вказано ID борта");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  const oldValues = sheet
    .getRange(row, 1, 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues()[0];

  const oldSerialNumber = String(oldValues[3] || "").trim();
  const oldReceivedDate = formatDate_(oldValues[4], "dd.MM.yyyy");
  const oldComment = String(oldValues[6] || "").trim();

  const newSerialNumber = String(
    serialNumber || ""
  ).trim();

  const newComment = String(
    comment || ""
  ).trim();

  const parsedReceivedDate =
    parseReceivedDate_(receivedDate);

  if (newSerialNumber) {
    const duplicateSerialRow =
      findAircraftRowBySerial_(
        sheet,
        newSerialNumber,
        row
      );

    if (duplicateSerialRow) {
      const existingAircraftId = String(
        sheet
          .getRange(
            duplicateSerialRow,
            AIRCRAFT_COLUMNS.ID
          )
          .getValue() || ""
      ).trim();

      throw new Error(
        "Серійний номер " +
        newSerialNumber +
        " уже використовується бортом " +
        existingAircraftId
      );
    }
  }

  const newReceivedDateText = parsedReceivedDate
    ? formatDate_(parsedReceivedDate, "dd.MM.yyyy")
    : "";

  const changes = [];

  if (oldSerialNumber !== newSerialNumber) {
    changes.push(
      "Серійний номер: " +
      (oldSerialNumber || "не вказано") +
      " → " +
      (newSerialNumber || "не вказано")
    );
  }

  if (oldReceivedDate !== newReceivedDateText) {
    changes.push(
      "Дата отримання: " +
      (oldReceivedDate || "не вказано") +
      " → " +
      (newReceivedDateText || "не вказано")
    );
  }

  if (oldComment !== newComment) {
    changes.push("Коментар змінено");
  }

  if (!changes.length) {
    return {
      success: true,
      unchanged: true,
      message: "Змін немає",
      aircraft: getAircraft(normalizedId)
    };
  }

  const now = new Date();

  sheet
    .getRange(row, AIRCRAFT_COLUMNS.SERIAL_NUMBER)
    .setValue(newSerialNumber);

  if (parsedReceivedDate) {
    sheet
      .getRange(row, AIRCRAFT_COLUMNS.RECEIVED_DATE)
      .setValue(parsedReceivedDate);
  } else {
    sheet
      .getRange(row, AIRCRAFT_COLUMNS.RECEIVED_DATE)
      .clearContent();
  }

  sheet
    .getRange(row, AIRCRAFT_COLUMNS.COMMENT)
    .setValue(newComment);

  sheet
    .getRange(row, AIRCRAFT_COLUMNS.LAST_CHANGE)
    .setValue(now);

  appendHistory_(
    now,
    normalizedId,
    "",
    "",
    "ДАНІ БОРТА: " + changes.join("; ")
  );

  return {
    success: true,
    unchanged: false,
    message: "Дані борта оновлено",
    aircraft: getAircraft(normalizedId)
  };
}


/* =========================
   STARLINKS
   ========================= */


function aircraftFromRow_(sheet, row) {
  const values = sheet
    .getRange(row, 1, 1, AIRCRAFT_COLUMNS.BATCH_ID)
    .getValues()[0];

  return aircraftFromValues_(values, row);
}


function aircraftFromValues_(values, row) {
  return {
    row: row,
    id: String(values[0] || ""),
    status: String(values[1] || "Не вказано"),
    starlink: String(values[2] || ""),
    serialNumber: String(values[3] || ""),
    receivedDate: formatDate_(values[4], "dd.MM.yyyy"),
    lastChange: formatDate_(values[5], "dd.MM.yyyy HH:mm:ss"),
    comment: String(values[6] || "")
  };
}


function findAircraftRow_(sheet, id) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const ids = sheet
    .getRange(2, AIRCRAFT_COLUMNS.ID, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < ids.length; i++) {
    const currentId = normalizeAircraftId_(ids[i][0]);

    if (currentId === id) {
      return i + 2;
    }
  }

  return null;
}


function getNextAircraftIdFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const ids = sheet
      .getRange(
        2,
        AIRCRAFT_COLUMNS.ID,
        lastRow - 1,
        1
      )
      .getValues();

    ids.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^HN-(\d{4})$/);

      if (!match) {
        return;
      }

      const number = Number(match[1]);

      if (number > maxNumber) {
        maxNumber = number;
      }
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 9999) {
    throw new Error(
      "Закінчився доступний діапазон ID HN-0001–HN-9999"
    );
  }

  return "HN-" + String(nextNumber).padStart(4, "0");
}


function findAircraftRowBySerial_(
  sheet,
  serialNumber,
  excludedRow
) {
  const normalizedSerial = String(
    serialNumber || ""
  )
    .trim()
    .toUpperCase();

  if (!normalizedSerial) {
    return null;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(
      2,
      AIRCRAFT_COLUMNS.SERIAL_NUMBER,
      lastRow - 1,
      1
    )
    .getValues();

  for (let i = 0; i < values.length; i++) {
    const row = i + 2;

    if (excludedRow && row === excludedRow) {
      continue;
    }

    const currentSerial = String(
      values[i][0] || ""
    )
      .trim()
      .toUpperCase();

    if (currentSerial === normalizedSerial) {
      return row;
    }
  }

  return null;
}


function normalizeAircraftId_(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();

  const match = text.match(/HN-\d{4}/);
  return match ? match[0] : "";
}


/**
 * ОДНОРАЗОВА міграція (2026-07-24): перейменування статусів.
 *   "БГ"        -> "На позиції"   (для ВСІХ бортів з цим статусом)
 *   "Майстерня" -> "На переробці на БГ" (лише для HN-0003 і HN-0009 —
 *                   решта бортів з "Майстерня" на момент міграції
 *                   не було; якщо з'являться інші, лишаться без змін
 *                   і потребуватимуть ручного рішення).
 *
 * Запускати вручну ОДИН РАЗ з редактора Apps Script (Run), не через
 * doGet — це службова дія, не публічний API.
 */
function migrateAircraftStatusRename_20260724_() {
  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { updated: 0 };
  }

  const REFURBISH_TARGET_IDS = ["HN-0003", "HN-0009"];

  const values = sheet
    .getRange(2, AIRCRAFT_COLUMNS.ID, lastRow - 1, 2)
    .getValues();

  let updated = 0;
  const changes = [];

  values.forEach(function (row, index) {
    const id = normalizeAircraftId_(row[0]);
    const status = String(row[1] || "").trim();

    if (!id) {
      return;
    }

    let newStatus = null;

    if (status === "БГ") {
      newStatus = "На позиції";
    } else if (
      status === "Майстерня" &&
      REFURBISH_TARGET_IDS.indexOf(id) !== -1
    ) {
      newStatus = "На переробці на БГ";
    }

    if (newStatus) {
      sheet
        .getRange(index + 2, AIRCRAFT_COLUMNS.STATUS)
        .setValue(newStatus);

      updated++;
      changes.push(id + ": " + status + " -> " + newStatus);
    }
  });

  Logger.log(
    "migrateAircraftStatusRename_20260724_: оновлено " +
      updated +
      " бортів.\n" +
      changes.join("\n")
  );

  return { updated: updated, changes: changes };
}