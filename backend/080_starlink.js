function listStarlinksByStatus(status) {
  const normalizedStatus = String(status || "").trim();

  if (!normalizedStatus) {
    throw new Error("Не вказано статус STARLINK");
  }

  const acceptedStatus = normalizeStarlinkStatusFilter_(normalizedStatus);
  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 5)
    .getValues();

  return values
    .map(function (row, index) {
      return {
        row: index + 2,
        id: String(row[0] || ""),
        status: String(row[1] || "Вільний"),
        linkedAircraft: String(row[2] || ""),
        serialNumber: String(row[3] || ""),
        comment: String(row[4] || "")
      };
    })
    .filter(function (starlink) {
      return starlinkStatusMatchesFilter_(
        starlink,
        acceptedStatus
      );
    });
}


function normalizeStarlinkStatusFilter_(status) {
  const aliases = {
    FREE: "Вільний",
    "ВІЛЬНІ": "Вільний",
    "ВІЛЬНИЙ": "Вільний",
    ASSIGNED: "На борту",
    "НА БОРТАХ": "На борту",
    "НА БОРТУ": "На борту",
    BROKEN: "Несправний",
    "НЕСПРАВНІ": "Несправний",
    "НЕСПРАВНИЙ": "Несправний",
    USED: "Використаний",
    "ВИКОРИСТАНІ": "Використаний",
    "ВИКОРИСТАНИЙ": "Використаний"
  };

  const key = String(status || "").trim().toUpperCase();
  const normalized = aliases[key] || String(status || "").trim();

  if (
    !["Вільний", "На борту", "Несправний", "Використаний"].includes(
      normalized
    )
  ) {
    throw new Error("Некоректний статус STARLINK");
  }

  return normalized;
}


function starlinkStatusMatchesFilter_(starlink, filterStatus) {
  const status = String(starlink.status || "").trim();
  const linkedAircraft = String(starlink.linkedAircraft || "").trim();

  if (filterStatus === "Використаний") {
    return status === "Використаний" || status === "Списаний";
  }

  if (filterStatus === "Несправний") {
    return status === "Несправний" || status === "Ремонт";
  }

  if (filterStatus === "На борту") {
    // Заблокований статус (Списаний/Використаний/Несправний/Ремонт)
    // означає, що STARLINK більше не "на борту", навіть якщо в даних
    // залишилась застаріла прив'язка до борта (наприклад, після
    // ручного редагування таблиці напряму в Google Sheets).
    if (BLOCKED_STARLINK_STATUSES.includes(status)) {
      return false;
    }

    return status === "На борту" || Boolean(linkedAircraft);
  }

  return (
    !linkedAircraft &&
    !BLOCKED_STARLINK_STATUSES.includes(status) &&
    status !== "На борту"
  );
}


/* =========================
   AIRCRAFT
   ========================= */


function getAvailableStarlinks(aircraftId) {
  const normalizedAircraftId = normalizeAircraftId_(aircraftId);

  if (!normalizedAircraftId) {
    throw new Error("Не вказано ID борта");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const result = [];

  values.forEach(function (row) {
    const id = String(row[0] || "").trim();
    const status = String(row[1] || "").trim();
    const linkedAircraft = String(row[2] || "").trim().toUpperCase();
    const serialNumber = String(row[3] || "").trim();

    if (!id) return;

    const blocked = BLOCKED_STARLINK_STATUSES.includes(status);
    const belongsToCurrentAircraft =
      linkedAircraft === normalizedAircraftId;
    const isFree = !linkedAircraft && !blocked;

    if (isFree || belongsToCurrentAircraft) {
      result.push({
        id: id,
        serialNumber: serialNumber,
        status: status || "Вільний",
        linkedAircraft: linkedAircraft,
        current: belongsToCurrentAircraft
      });
    }
  });

  result.sort(function (a, b) {
    if (a.current && !b.current) return -1;
    if (!a.current && b.current) return 1;
    return a.id.localeCompare(b.id);
  });

  return result;
}


function getStarlink(id) {
  const normalizedId = normalizeStarlinkId_(id);

  if (!normalizedId) {
    throw new Error("Не вказано ID STARLINK");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const row = findStarlinkRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("STARLINK " + normalizedId + " не знайдено");
  }

  const values = sheet.getRange(row, 1, 1, 5).getValues()[0];

  return {
    row: row,
    id: String(values[0] || ""),
    status: String(values[1] || "Вільний"),
    linkedAircraft: String(values[2] || ""),
    serialNumber: String(values[3] || ""),
    comment: String(values[4] || "")
  };
}


function searchStarlinks(query) {
  const text = String(query || "").trim().toUpperCase();

  if (!text) {
    throw new Error("Введіть ID або серійний номер STARLINK");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const result = [];

  values.forEach(function (row, index) {
    const id = String(row[0] || "").trim().toUpperCase();
    const serial = String(row[3] || "").trim().toUpperCase();

    if (id.includes(text) || serial.includes(text)) {
      result.push({
        row: index + 2,
        id: String(row[0] || ""),
        status: String(row[1] || "Вільний"),
        linkedAircraft: String(row[2] || ""),
        serialNumber: String(row[3] || ""),
        comment: String(row[4] || "")
      });
    }
  });

  return result.slice(0, 25);
}


function getNextStarlinkId() {
  const sheet =
    getRequiredSheet_(STARLINKS_SHEET);

  return getNextStarlinkIdFromSheet_(sheet);
}


function createStarlink(
  serialNumber,
  comment
) {
  const normalizedSerialNumber = String(
    serialNumber || ""
  ).trim();

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(20000);

  try {
    const sheet =
      getRequiredSheet_(STARLINKS_SHEET);

    const newStarlinkId =
      getNextStarlinkIdFromSheet_(sheet);

    if (normalizedSerialNumber) {
      const duplicateSerialRow =
        findStarlinkRowBySerial_(
          sheet,
          normalizedSerialNumber
        );

      if (duplicateSerialRow) {
        const existingStarlinkId = String(
          sheet
            .getRange(
              duplicateSerialRow,
              STARLINK_COLUMNS.ID
            )
            .getValue() || ""
        ).trim();

        throw new Error(
          "Серійний номер " +
          normalizedSerialNumber +
          " уже використовується STARLINK " +
          existingStarlinkId
        );
      }
    }

    sheet.appendRow([
      newStarlinkId,
      "Вільний",
      "",
      normalizedSerialNumber,
      String(comment || "").trim()
    ]);

    return {
      success: true,
      message: "STARLINK додано",
      starlink: getStarlink(newStarlinkId)
    };
  } finally {
    lock.releaseLock();
  }
}


/**
 * Масове створення STARLINK за один раз — приймає список серійних
 * номерів (масив, або текст з роздільниками \n/,/;/tab, або JSON-рядок
 * масиву), кожен стає окремим STARLINK зі статусом "Вільний". ID
 * генеруються послідовно від наступного вільного номера.
 */
function createStarlinkBatch(serialNumbers, comment, initialStatus) {
  const normalizedComment = String(comment || "").trim();
  const values = parseStarlinkBatchSerialNumbers_(serialNumbers);

  const MANUAL_STARLINK_STATUSES = [
    "Вільний",
    "Несправний",
    "Ремонт",
    "Використаний",
    "Списаний"
  ];

  const normalizedStatus = String(initialStatus || "Вільний").trim();

  if (MANUAL_STARLINK_STATUSES.indexOf(normalizedStatus) === -1) {
    throw new Error("Некоректний початковий статус STARLINK");
  }

  if (!values.length) {
    throw new Error("Вкажи хоча б один серійний номер");
  }

  if (values.length > 500) {
    throw new Error("Максимум 500 STARLINK за один раз");
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getRequiredSheet_(STARLINKS_SHEET);

    validateStarlinkBatchSerialNumbers_(sheet, values);

    const firstStarlinkId = getNextStarlinkIdFromSheet_(sheet);
    const firstNumber = Number(firstStarlinkId.replace(/^MINI_/, ""));
    const lastNumber = firstNumber + values.length - 1;

    if (lastNumber > 9999) {
      throw new Error(
        "Партія виходить за межі діапазону MINI_0001–MINI_9999"
      );
    }

    const rows = [];
    const starlinkIds = [];

    for (let index = 0; index < values.length; index++) {
      const starlinkId =
        "MINI_" + String(firstNumber + index).padStart(3, "0");

      starlinkIds.push(starlinkId);

      rows.push([
        starlinkId,
        normalizedStatus,
        "",
        values[index],
        normalizedComment
      ]);
    }

    const startRow = sheet.getLastRow() + 1;

    sheet
      .getRange(startRow, 1, rows.length, 5)
      .setValues(rows);

    return {
      success: true,
      message: "Створено " + starlinkIds.length + " STARLINK",
      quantity: starlinkIds.length,
      firstStarlink: starlinkIds[0],
      lastStarlink: starlinkIds[starlinkIds.length - 1],
      starlinkIds: starlinkIds
    };
  } finally {
    lock.releaseLock();
  }
}


function parseStarlinkBatchSerialNumbers_(serialNumbers) {
  let values = [];

  if (Array.isArray(serialNumbers)) {
    values = serialNumbers;
  } else {
    const text = String(serialNumbers || "").trim();

    if (text) {
      try {
        const parsed = JSON.parse(text);
        values = Array.isArray(parsed)
          ? parsed
          : text.split(/[\n,;\t]+/);
      } catch (error) {
        values = text.split(/[\n,;\t]+/);
      }
    }
  }

  const normalized = values
    .map(function (value) {
      return String(value || "").trim();
    })
    .filter(function (value) {
      return Boolean(value);
    });

  const upper = normalized.map(function (value) {
    return value.toUpperCase();
  });

  if (new Set(upper).size !== upper.length) {
    throw new Error("У списку є дублікати серійних номерів");
  }

  return normalized;
}


function validateStarlinkBatchSerialNumbers_(sheet, serialNumbers) {
  const requested = new Set(
    serialNumbers.map(function (value) {
      return value.toUpperCase();
    })
  );

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, STARLINK_COLUMNS.SERIAL_NUMBER)
    .getValues();

  for (let index = 0; index < values.length; index++) {
    const serial = String(
      values[index][STARLINK_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    if (serial && requested.has(serial)) {
      const starlinkId = String(
        values[index][STARLINK_COLUMNS.ID - 1] || ""
      ).trim();

      throw new Error(
        "Серійний номер " +
        serial +
        " уже використовується STARLINK " +
        starlinkId
      );
    }
  }
}


/**
 * Ручна зміна статусу одного STARLINK (наприклад, з картки після
 * пошуку за KIT-номером) — не пов'язана з прив'язкою до борта.
 * Якщо STARLINK на момент зміни прив'язаний до борта і новий статус
 * не "Вільний" — прив'язка знімається з обох боків (борт більше не
 * показуватиме цей STARLINK як встановлений).
 */
function setStarlinkStatus(starlinkId, newStatus) {
  const normalizedId = normalizeStarlinkId_(starlinkId);
  const normalizedStatus = String(newStatus || "").trim();

  const MANUAL_STARLINK_STATUSES = [
    "Вільний",
    "Несправний",
    "Ремонт",
    "Використаний",
    "Списаний"
  ];

  if (!normalizedId) {
    throw new Error("Не вказано ID STARLINK");
  }

  if (MANUAL_STARLINK_STATUSES.indexOf(normalizedStatus) === -1) {
    throw new Error("Некоректний статус STARLINK");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const row = findStarlinkRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("STARLINK " + normalizedId + " не знайдено");
  }

  const linkedAircraft = String(
    sheet.getRange(row, STARLINK_COLUMNS.AIRCRAFT_ID).getValue() || ""
  ).trim();

  sheet.getRange(row, STARLINK_COLUMNS.STATUS).setValue(normalizedStatus);

  if (linkedAircraft) {
    // "Вільний" і решта ручних статусів однаково несумісні з
    // прив'язкою до борта — знімаємо її з обох боків.
    sheet.getRange(row, STARLINK_COLUMNS.AIRCRAFT_ID).setValue("");

    const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
    const aircraftRow = findAircraftRow_(aircraftSheet, linkedAircraft);

    if (aircraftRow) {
      const currentAircraftStarlink = String(
        aircraftSheet
          .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
          .getValue() || ""
      ).trim();

      if (currentAircraftStarlink === normalizedId) {
        aircraftSheet
          .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
          .setValue("");
      }
    }
  }

  return {
    success: true,
    message: "Статус STARLINK змінено",
    starlink: getStarlink(normalizedId)
  };
}


/**
 * Редагування ЛИШЕ коментаря STARLINK (без зміни статусу/прив'язки) —
 * доступне для WAREHOUSE та COMBAT.
 */
function updateStarlinkComment(id, comment) {
  const normalizedId = normalizeStarlinkId_(id);

  if (!normalizedId) {
    throw new Error("Не вказано ID STARLINK");
  }

  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const row = findStarlinkRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("STARLINK " + normalizedId + " не знайдено");
  }

  const newComment = String(comment || "").trim();

  sheet
    .getRange(row, STARLINK_COLUMNS.COMMENT)
    .setValue(newComment);

  return {
    success: true,
    message: "Коментар збережено",
    starlink: getStarlink(normalizedId)
  };
}


function assignStarlink(aircraftId, starlinkId) {
  const normalizedAircraftId = normalizeAircraftId_(aircraftId);
  const normalizedStarlinkId = String(starlinkId || "").trim();

  if (!normalizedAircraftId) {
    throw new Error("Не вказано ID борта");
  }

  const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const starlinksSheet = getRequiredSheet_(STARLINKS_SHEET);

  const aircraftRow = findAircraftRow_(
    aircraftSheet,
    normalizedAircraftId
  );

  if (!aircraftRow) {
    throw new Error("Борт " + normalizedAircraftId + " не знайдено");
  }

  const aircraftStatus = String(
    aircraftSheet
      .getRange(aircraftRow, AIRCRAFT_COLUMNS.STATUS)
      .getValue() || ""
  ).trim();

  const currentStarlink = String(
    aircraftSheet
      .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
      .getValue() || ""
  ).trim();

  if (currentStarlink === normalizedStarlinkId) {
    return {
      success: true,
      unchanged: true,
      message: "Цей Starlink уже прив’язаний",
      starlink: currentStarlink
    };
  }

  if (
    aircraftStatus === "Використаний" ||
    aircraftStatus === "Списаний"
  ) {
    throw new Error(
      "Не можна змінювати STARLINK архівного борта"
    );
  }

  let newStarlinkRow = null;
  let newStarlinkSerialNumber = "";

  if (normalizedStarlinkId) {
    newStarlinkRow = findStarlinkRow_(
      starlinksSheet,
      normalizedStarlinkId
    );

    if (!newStarlinkRow) {
      throw new Error(
        "Starlink " + normalizedStarlinkId + " не знайдено"
      );
    }

    const newStarlinkValues = starlinksSheet
      .getRange(newStarlinkRow, 1, 1, 5)
      .getValues()[0];

    newStarlinkSerialNumber = String(
      newStarlinkValues[STARLINK_COLUMNS.SERIAL_NUMBER - 1] || ""
    ).trim();

    const newStarlinkStatus = String(
      newStarlinkValues[1] || ""
    ).trim();

    const linkedAircraft = String(
      newStarlinkValues[2] || ""
    ).trim().toUpperCase();

    if (BLOCKED_STARLINK_STATUSES.includes(newStarlinkStatus)) {
      throw new Error(
        "Starlink має статус «" + newStarlinkStatus + "»"
      );
    }

    if (
      linkedAircraft &&
      linkedAircraft !== normalizedAircraftId
    ) {
      throw new Error(
        "Starlink уже прив’язаний до " + linkedAircraft
      );
    }
  }

  if (currentStarlink) {
    const oldStarlinkRow = findStarlinkRow_(
      starlinksSheet,
      currentStarlink
    );

    if (oldStarlinkRow) {
      starlinksSheet
        .getRange(oldStarlinkRow, STARLINK_COLUMNS.STATUS)
        .setValue("Вільний");

      starlinksSheet
        .getRange(oldStarlinkRow, STARLINK_COLUMNS.AIRCRAFT_ID)
        .clearContent();
    }
  }

  if (normalizedStarlinkId && newStarlinkRow) {
    starlinksSheet
      .getRange(newStarlinkRow, STARLINK_COLUMNS.STATUS)
      .setValue("На борту");

    starlinksSheet
      .getRange(newStarlinkRow, STARLINK_COLUMNS.AIRCRAFT_ID)
      .setValue(normalizedAircraftId);
  }

  aircraftSheet
    .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
    .setValue(normalizedStarlinkId);

  appendHistory_(
    new Date(),
    normalizedAircraftId,
    "",
    "",
    "STARLINK: " +
      (currentStarlink || "не прив’язаний") +
      " → " +
      (normalizedStarlinkId || "не прив’язаний")
  );

  return {
    success: true,
    unchanged: false,
    message: normalizedStarlinkId
      ? "Starlink прив’язано"
      : "Starlink відв’язано",
    starlink: normalizedStarlinkId,
    starlinkSerialNumber: newStarlinkSerialNumber
  };
}


/* =========================
   QR PRINT QUEUE
   ========================= */


function getNextStarlinkIdFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const ids = sheet
      .getRange(
        2,
        STARLINK_COLUMNS.ID,
        lastRow - 1,
        1
      )
      .getValues();

    ids.forEach(function (row) {
      const text = String(row[0] || "")
        .trim()
        .toUpperCase();

      const match = text.match(
        /^MINI[_-](\d{2,4})$/
      );

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
      "Закінчився доступний діапазон " +
      "MINI_001–MINI_9999"
    );
  }

  return (
    "MINI_" +
    String(nextNumber).padStart(3, "0")
  );
}


function findStarlinkRowBySerial_(
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
      STARLINK_COLUMNS.SERIAL_NUMBER,
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


function findStarlinkRow_(sheet, starlinkId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const ids = sheet
    .getRange(2, STARLINK_COLUMNS.ID, lastRow - 1, 1)
    .getValues();

  const normalizedTarget = String(
    starlinkId || ""
  ).trim().toUpperCase();

  for (let i = 0; i < ids.length; i++) {
    const currentId = String(ids[i][0] || "")
      .trim()
      .toUpperCase();

    if (currentId === normalizedTarget) {
      return i + 2;
    }
  }

  return null;
}


/**
 * Позначає прив'язаний STARLINK як "Використаний" (борт, на якому він
 * стояв, спожито/втрачено) і знімає прив'язку до борта з обох боків.
 * Раніше ця функція називалась markLinkedStarlinkLost_ і ставила
 * статус "Втрачений" — перейменовано разом зі статусом (2026-08-02).
 */
function markLinkedStarlinkUsed_(aircraftSheet, aircraftRow) {
  const starlinkId = String(
    aircraftSheet
      .getRange(aircraftRow, AIRCRAFT_COLUMNS.STARLINK)
      .getValue() || ""
  ).trim();

  if (!starlinkId) {
    return;
  }

  const starlinksSheet = getRequiredSheet_(STARLINKS_SHEET);
  const starlinkRow = findStarlinkRow_(starlinksSheet, starlinkId);

  if (!starlinkRow) {
    return;
  }

  starlinksSheet
    .getRange(starlinkRow, STARLINK_COLUMNS.STATUS)
    .setValue("Використаний");

  starlinksSheet
    .getRange(starlinkRow, STARLINK_COLUMNS.AIRCRAFT_ID)
    .setValue("");
}


/**
 * ОДНОРАЗОВА міграція (2026-08-02): "Втрачений" -> "Використаний".
 * Запускати вручну ОДИН РАЗ з редактора Apps Script (Run).
 */
function migrateStarlinkStatusRename_20260802_() {
  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { updated: 0 };
  }

  const values = sheet
    .getRange(2, STARLINK_COLUMNS.ID, lastRow - 1, 2)
    .getValues();

  let updated = 0;
  const changes = [];

  values.forEach(function (row, index) {
    const id = String(row[0] || "").trim();
    const status = String(row[1] || "").trim();

    if (!id || status !== "Втрачений") {
      return;
    }

    sheet
      .getRange(index + 2, STARLINK_COLUMNS.STATUS)
      .setValue("Використаний");

    updated++;
    changes.push(id + ": Втрачений -> Використаний");
  });

  Logger.log(
    "migrateStarlinkStatusRename_20260802_: оновлено " +
      updated +
      " STARLINK.\n" +
      changes.join("\n")
  );

  return { updated: updated, changes: changes };
}


/**
 * ОДНОРАЗОВА міграція (2026-08-05): очищення застарілих прив'язок
 * "Прив'язаний до" у STARLINK, які мають заблокований статус
 * (Списаний/Використаний/Несправний/Ремонт), але досі числяться
 * прив'язаними до якогось борта — найімовірніше, через ручне
 * редагування статусу напряму в Google Sheets (onEdit стежить лише
 * за аркушем Aircraft, не за Starlinks, тож така правка не запускає
 * автоматичну очистку прив'язки).
 */
function cleanupBlockedStarlinkAircraftLinks_20260805_() {
  const sheet = getRequiredSheet_(STARLINKS_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { updated: 0 };
  }

  const values = sheet
    .getRange(2, STARLINK_COLUMNS.ID, lastRow - 1, 3)
    .getValues();

  let updated = 0;
  const changes = [];

  values.forEach(function (row, index) {
    const id = String(row[0] || "").trim();
    const status = String(row[1] || "").trim();
    const linkedAircraft = String(row[2] || "").trim();

    if (!id || !linkedAircraft) {
      return;
    }

    if (!BLOCKED_STARLINK_STATUSES.includes(status)) {
      return;
    }

    sheet
      .getRange(index + 2, STARLINK_COLUMNS.AIRCRAFT_ID)
      .setValue("");

    updated++;
    changes.push(
      id + " (" + status + "): прив'язку до " + linkedAircraft + " знято"
    );
  });

  Logger.log(
    "cleanupBlockedStarlinkAircraftLinks_20260805_: оновлено " +
      updated +
      " STARLINK.\n" +
      changes.join("\n")
  );

  return { updated: updated, changes: changes };
}


function normalizeStarlinkId_(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}