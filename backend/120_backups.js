function createBackup(comment) {
  ensureBackendFoundation_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceFile = DriveApp.getFileById(spreadsheet.getId());
    const backupFolder = getOrCreateBackupFolder_(sourceFile);
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd_HH-mm-ss"
    );
    const backupName = "Hornet_Control_Backup_" + timestamp;
    const backupFile = sourceFile.makeCopy(backupName, backupFolder);
    const backupId = nextBackupId_();
    const createdAt = new Date();
    const safeComment = String(comment || "").trim();

    const sheet = getBackupsSheet_(spreadsheet);
    const nextRow = sheet.getLastRow() + 1;

    sheet
      .getRange(nextRow, 1, 1, BACKUP_HEADERS.length)
      .setValues([[
        backupId,
        createdAt,
        backupName,
        backupFile.getId(),
        backupFile.getUrl(),
        safeComment
      ]]);

    logSystemEvent_(
      "INFO",
      "CREATE_BACKUP",
      "Резервну копію створено",
      {
        backupId: backupId,
        fileId: backupFile.getId(),
        name: backupName
      }
    );

    return {
      backupId: backupId,
      createdAt: formatDate_(createdAt, "dd.MM.yyyy HH:mm:ss"),
      name: backupName,
      fileId: backupFile.getId(),
      url: backupFile.getUrl(),
      comment: safeComment,
      message: "Резервну копію створено"
    };
  } finally {
    lock.releaseLock();
  }
}


function listBackups(limit) {
  ensureBackendFoundation_();

  const sheet = getBackupsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const requestedLimit = Math.max(
    1,
    Math.min(Number(limit) || 20, 100)
  );
  const values = sheet
    .getRange(2, 1, lastRow - 1, BACKUP_HEADERS.length)
    .getValues();

  return values
    .reverse()
    .slice(0, requestedLimit)
    .map(function (row) {
      const fileId = String(row[3] || "").trim();
      let available = false;

      if (fileId) {
        try {
          DriveApp.getFileById(fileId).getName();
          available = true;
        } catch (error) {
          available = false;
        }
      }

      return {
        backupId: String(row[0] || ""),
        createdAt: formatDate_(row[1], "dd.MM.yyyy HH:mm:ss"),
        name: String(row[2] || ""),
        fileId: fileId,
        url: String(row[4] || ""),
        comment: String(row[5] || ""),
        available: available
      };
    });
}


function getOrCreateBackupFolder_(sourceFile) {
  const parents = sourceFile.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const folders = parent.getFoldersByName(BACKUP_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(BACKUP_FOLDER_NAME);
}


function nextBackupId_() {
  const sheet = getBackupsSheet_();
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, 1, lastRow - 1, 1)
      .getValues();

    values.forEach(function (row) {
      const match = String(row[0] || "")
        .trim()
        .toUpperCase()
        .match(/^BK-(\d{6})$/);

      if (match) {
        maxNumber = Math.max(maxNumber, Number(match[1]));
      }
    });
  }

  return "BK-" + String(maxNumber + 1).padStart(6, "0");
}
