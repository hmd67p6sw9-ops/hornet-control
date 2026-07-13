/* Hornet Control v1.5.0-alpha1 */

async function startScanner() {
  scanLocked = false;
  selectedAircraftId = "";
  currentAircraftStatus = "";
  currentStarlinkId = "";
  selectedStarlinkId = "";
  currentAircraftData = null;

  closeAllContentModals();

  document.getElementById("aircraftCard").classList.add("hidden");
  document.getElementById("scannerCard").classList.remove("hidden");
  document.getElementById("cameraButton").classList.add("hidden");

  showMessage("Запуск камери…", "info");

  if (!scanner) {
    scanner = new Html5Qrcode("reader");
  }

  try {
    await scanner.start(
      { facingMode: { exact: "environment" } },
      {
        fps: 12,
        qrbox: function (width, height) {
          const size = Math.floor(Math.min(width, height) * 0.75);
          return { width: size, height: size };
        },
      },
      onScanSuccess,
      function () {},
    );

    scannerRunning = true;
    hideMessage();
  } catch (firstError) {
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: 250 },
        onScanSuccess,
        function () {},
      );

      scannerRunning = true;
      hideMessage();
    } catch (secondError) {
      scannerRunning = false;
      showMessage(
        "Автоматичний запуск камери заблокований. Натисни кнопку нижче.",
        "error",
      );
      document.getElementById("cameraButton").classList.remove("hidden");
    }
  }
}

async function stopScanner() {
  if (!scanner || !scannerRunning) return;

  try {
    await scanner.stop();
  } catch (error) {
    console.log(error);
  }

  scannerRunning = false;
}

async function onScanSuccess(decodedText) {
  if (scanLocked) return;

  const id = normalizeId(decodedText);
  if (!id) return;

  scanLocked = true;
  await stopScanner();
  loadAircraft(id);
}

function normalizeId(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const match = text.match(/HN-\d{4}/);
  return match ? match[0] : "";
}

function scanAnotherAircraft() {
  const cardMessage = document.getElementById("cardMessage");
  if (cardMessage) cardMessage.remove();

  startScanner();
}
