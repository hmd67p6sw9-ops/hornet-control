/* =========================
   POSITIONS v1.6.3-alpha1
   ========================= */


function listPositions() {
  ensureBackendFoundation_();

  const sheet = getPositionsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 2)
    .getValues();

  return values
    .map(function (row) {
      return {
        name: String(row[0] || "").trim(),
        createdAt: formatDate_(row[1], "dd.MM.yyyy HH:mm:ss")
      };
    })
    .filter(function (position) {
      return Boolean(position.name);
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name, "uk");
    });
}


function createPosition(name) {
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    throw new Error("Вкажи назву позиції");
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);

  try {
    const sheet = getPositionsSheet_();
    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const existingNames = sheet
        .getRange(2, 1, lastRow - 1, 1)
        .getValues()
        .map(function (row) {
          return String(row[0] || "").trim().toUpperCase();
        });

      if (existingNames.indexOf(normalizedName.toUpperCase()) !== -1) {
        throw new Error(
          "Позиція «" + normalizedName + "» вже існує"
        );
      }
    }

    sheet.appendRow([normalizedName, new Date()]);

    return {
      success: true,
      message: "Позицію «" + normalizedName + "» додано",
      positions: listPositions()
    };
  } finally {
    lock.releaseLock();
  }
}


function findPositionByName_(name) {
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    return null;
  }

  const positions = listPositions();

  return positions.find(function (position) {
    return (
      position.name.toUpperCase() === normalizedName.toUpperCase()
    );
  }) || null;
}


/**
 * Призначає борт на конкретну позицію — атомарно ставить статус
 * "На позиції" і записує саму позицію. Це ЄДИНИЙ спосіб перевести
 * борт у статус "На позиції" (updateAircraftStatus явно відхиляє
 * прямі спроби, щоб позиція завжди була вказана).
 */
function assignAircraftPosition(id, positionName) {
  const normalizedId = normalizeAircraftId_(id);
  const normalizedPositionName = String(positionName || "").trim();

  if (!normalizedId) {
    throw new Error("Не вказано ID борта");
  }

  const position = findPositionByName_(normalizedPositionName);

  if (!position) {
    throw new Error(
      "Позицію «" + normalizedPositionName + "» не знайдено"
    );
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const row = findAircraftRow_(sheet, normalizedId);

  if (!row) {
    throw new Error("Борт " + normalizedId + " не знайдено");
  }

  const oldStatus = String(
    sheet.getRange(row, AIRCRAFT_COLUMNS.STATUS).getValue() || ""
  ).trim();

  const oldPosition = String(
    sheet.getRange(row, AIRCRAFT_COLUMNS.POSITION).getValue() || ""
  ).trim();

  const now = new Date();

  // Гарантовано оновлюємо правило валідації статусу перед записом —
  // той самий запобіжник, що й в updateAircraftStatus.
  sheet
    .getRange(row, AIRCRAFT_COLUMNS.STATUS)
    .setDataValidation(
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(ALLOWED_STATUSES, true)
        .setAllowInvalid(false)
        .setHelpText("Вибери статус зі списку")
        .build()
    );

  SpreadsheetApp.flush();

  sheet.getRange(row, AIRCRAFT_COLUMNS.STATUS).setValue("На позиції");
  sheet.getRange(row, AIRCRAFT_COLUMNS.POSITION).setValue(position.name);
  sheet.getRange(row, AIRCRAFT_COLUMNS.LAST_CHANGE).setValue(now);

  if (oldStatus === "На позиції" && oldPosition === position.name) {
    return {
      success: true,
      unchanged: true,
      message: "Борт уже на позиції «" + position.name + "»",
      aircraft: getAircraft(normalizedId)
    };
  }

  const historyComment =
    oldStatus === "На позиції"
      ? "ПОЗИЦІЯ: " + (oldPosition || "не вказано") + " → " + position.name
      : "";

  appendHistory_(
    now,
    normalizedId,
    oldStatus,
    "На позиції",
    historyComment
  );

  return {
    success: true,
    unchanged: false,
    message: "Борт направлено на позицію «" + position.name + "»",
    aircraft: getAircraft(normalizedId)
  };
}


function listAircraftByPosition(positionName) {
  ensureBackendFoundation_();

  const normalizedPositionName = String(positionName || "").trim();

  if (!normalizedPositionName) {
    throw new Error("Не вказано позицію");
  }

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, AIRCRAFT_COLUMNS.POSITION)
    .getValues();

  const matched = values
    .map(function (row, index) {
      return aircraftFromValues_(row, index + 2);
    })
    .filter(function (aircraft) {
      return (
        String(aircraft.position || "").trim().toUpperCase() ===
        normalizedPositionName.toUpperCase()
      );
    });

  attachStarlinkSerialNumbers_(matched);

  return matched;
}


/**
 * Підрахунок кількості бортів на кожній позиції — для Dashboard.
 * Повертає масив {name, count}, включно з позиціями без жодного
 * борта (count: 0), щоб адмін бачив увесь список одразу.
 */
function getPositionCounts_() {
  const positions = listPositions();
  const counts = {};

  positions.forEach(function (position) {
    counts[position.name] = 0;
  });

  const sheet = getRequiredSheet_(AIRCRAFT_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, AIRCRAFT_COLUMNS.POSITION, lastRow - 1, 1)
      .getValues();

    values.forEach(function (row) {
      const name = String(row[0] || "").trim();

      if (name && Object.prototype.hasOwnProperty.call(counts, name)) {
        counts[name]++;
      }
    });
  }

  return positions.map(function (position) {
    return {
      name: position.name,
      count: counts[position.name] || 0
    };
  });
}