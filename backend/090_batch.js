function createBatch(
  quantity,
  status,
  createdDate,
  comment,
  serialNumbers
) {
  const parsedQuantity = Number(quantity);
  const normalizedStatus = String(status || "На складі").trim();
  const parsedCreatedDate = parseReceivedDate_(createdDate) || new Date();
  const normalizedComment = String(comment || "").trim();

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
    throw new Error("Кількість має бути додатним цілим числом");
  }

  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    throw new Error("Некоректний статус");
  }

  const normalizedSerialNumbers = parseBatchSerialNumbers_(
    serialNumbers,
    parsedQuantity
  );

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    ensureBackendFoundation_();

    const aircraftSheet = getRequiredSheet_(AIRCRAFT_SHEET);
    const batchesSheet = getBatchesSheet_();
    const historySheet = getRequiredSheet_(HISTORY_SHEET);
    const qrQueueSheet = getQrQueueSheet_();

    validateBatchSerialNumbers_(
      aircraftSheet,
      normalizedSerialNumbers
    );

    const batchId = getNextBatchIdFromSheet_(batchesSheet);
    const firstAircraftId = getNextAircraftIdFromSheet_(aircraftSheet);
    const firstAircraftNumber = Number(firstAircraftId.slice(3));
    const lastAircraftNumber = firstAircraftNumber + parsedQuantity - 1;

    if (lastAircraftNumber > 9999) {
      throw new Error(
        "Партія виходить за межі діапазону HN-0001–HN-9999"
      );
    }

    const now = new Date();
    const aircraftRows = [];
    const historyRows = [];
    const qrRows = [];
    const aircraftIds = [];

    for (let index = 0; index < parsedQuantity; index++) {
      const aircraftId =
        "HN-" +
        String(firstAircraftNumber + index).padStart(4, "0");

      aircraftIds.push(aircraftId);

      aircraftRows.push([
        aircraftId,
        normalizedStatus,
        "",
        normalizedSerialNumbers[index] || "",
        parsedCreatedDate,
        now,
        normalizedComment,
        batchId
      ]);

      historyRows.push([
        now,
        aircraftId,
        "",
        normalizedStatus,
        "BATCH_CREATE: " + batchId
      ]);

      qrRows.push([
        aircraftId,
        now,
        false,
        ""
      ]);
    }

    const batchRow = [[
      batchId,
      parsedCreatedDate,
      parsedQuantity,
      normalizedComment,
      aircraftIds[0],
      aircraftIds[aircraftIds.length - 1],
      now
    ]];

    const startRows = {
      aircraft: aircraftSheet.getLastRow() + 1,
      batches: batchesSheet.getLastRow() + 1,
      history: historySheet.getLastRow() + 1,
      qr: qrQueueSheet.getLastRow() + 1
    };

    const written = {
      aircraft: false,
      batches: false,
      history: false,
      qr: false
    };

    try {
      aircraftSheet
        .getRange(
          startRows.aircraft,
          1,
          aircraftRows.length,
          AIRCRAFT_COLUMNS.BATCH_ID
        )
        .setValues(aircraftRows);
      written.aircraft = true;

      batchesSheet
        .getRange(
          startRows.batches,
          1,
          1,
          BATCH_HEADERS.length
        )
        .setValues(batchRow);
      written.batches = true;

      historySheet
        .getRange(
          startRows.history,
          1,
          historyRows.length,
          5
        )
        .setValues(historyRows);
      written.history = true;

      qrQueueSheet
        .getRange(
          startRows.qr,
          1,
          qrRows.length,
          4
        )
        .setValues(qrRows);
      written.qr = true;
    } catch (error) {
      rollbackBatchWrite_(
        aircraftSheet,
        batchesSheet,
        historySheet,
        qrQueueSheet,
        startRows,
        written,
        parsedQuantity
      );

      throw error;
    }

    return {
      success: true,
      message: "Партію створено",
      quantity: parsedQuantity,
      firstAircraft: aircraftIds[0],
      lastAircraft: aircraftIds[aircraftIds.length - 1],
      aircraftIds: aircraftIds
    };
  } finally {
    lock.releaseLock();
  }
}


function rollbackBatchWrite_(
  aircraftSheet,
  batchesSheet,
  historySheet,
  qrQueueSheet,
  startRows,
  written,
  quantity
) {
  if (written.qr) {
    qrQueueSheet
      .getRange(startRows.qr, 1, quantity, 4)
      .clearContent();
  }

  if (written.history) {
    historySheet
      .getRange(startRows.history, 1, quantity, 5)
      .clearContent();
  }

  if (written.batches) {
    batchesSheet
      .getRange(startRows.batches, 1, 1, BATCH_HEADERS.length)
      .clearContent();
  }

  if (written.aircraft) {
    aircraftSheet
      .getRange(
        startRows.aircraft,
        1,
        quantity,
        AIRCRAFT_COLUMNS.BATCH_ID
      )
      .clearContent();
  }
}


function parseBatchSerialNumbers_(serialNumbers, quantity) {
  let values = [];

  if (Array.isArray(serialNumbers)) {
    values = serialNumbers;
  } else {
    const text = String(serialNumbers || "").trim();

    if (text) {
      try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          values = parsed;
        } else {
          values = text.split(/[\n,;]+/);
        }
      } catch (error) {
        values = text.split(/[\n,;]+/);
      }
    }
  }

  const normalized = values.map(function (value) {
    return String(value || "").trim();
  });

  if (normalized.length > quantity) {
    throw new Error(
      "Передано більше серійних номерів, ніж бортів у партії"
    );
  }

  while (normalized.length < quantity) {
    normalized.push("");
  }

  const nonEmpty = normalized
    .filter(function (value) {
      return Boolean(value);
    })
    .map(function (value) {
      return value.toUpperCase();
    });

  if (new Set(nonEmpty).size !== nonEmpty.length) {
    throw new Error("У партії є дублікати серійних номерів");
  }

  return normalized;
}


function validateBatchSerialNumbers_(sheet, serialNumbers) {
  const requested = new Set(
    serialNumbers
      .filter(function (value) {
        return Boolean(value);
      })
      .map(function (value) {
        return value.toUpperCase();
      })
  );

  if (!requested.size) {
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const values = sheet
    .getRange(
      2,
      AIRCRAFT_COLUMNS.ID,
      lastRow - 1,
      AIRCRAFT_COLUMNS.SERIAL_NUMBER
    )
    .getValues();

  for (let index = 0; index < values.length; index++) {
    const serial = String(
      values[index][AIRCRAFT_COLUMNS.SERIAL_NUMBER - 1] || ""
    )
      .trim()
      .toUpperCase();

    if (serial && requested.has(serial)) {
      const aircraftId = String(
        values[index][AIRCRAFT_COLUMNS.ID - 1] || ""
      ).trim();

      throw new Error(
        "Серійний номер " +
        serial +
        " уже використовується бортом " +
        aircraftId
      );
    }
  }
}


function getNextBatchIdFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, BATCH_COLUMNS.ID, lastRow - 1, 1)
      .getValues();

    values.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^BT-(\d{6})$/);

      if (!match) {
        return;
      }

      maxNumber = Math.max(maxNumber, Number(match[1]));
    });
  }

  const nextNumber = maxNumber + 1;

  if (nextNumber > 999999) {
    throw new Error("Закінчився діапазон ID партій");
  }

  return "BT-" + String(nextNumber).padStart(6, "0");
}
