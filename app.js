/* Hornet Control v1.5.0-RC1 */

const API_URL = "ВСТАВ_СЮДИ_СВІЙ_URL_APPS_SCRIPT_EXEC";
const API_KEY = "ВСТАВ_СЮДИ_СВІЙ_API_KEY";

let scanner = null;
let scannerRunning = false;
let scanLocked = false;

let selectedAircraftId = "";
let currentAircraftStatus = "";
let currentStarlinkId = "";
let selectedStarlinkId = "";
let currentAircraftData = null;
let generatedQrAircraftId = "";
let generatedQrDataUrl = "";
let qrQueueItems = [];
let currentPrintSettings = null;
let printTemplates = [];
let selectedPrintTemplate = null;
let jsPdfLoadPromise = null;


function initializeApplication() {
  initializeDashboard();
  refreshQrQueueCount();
}

window.addEventListener("load", initializeApplication);

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async function () {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "./sw.js",
            {
              updateViaCache: "none"
            }
          );

        await registration.update();

        setInterval(function () {
          registration.update();
        }, 5 * 60 * 1000);

        let refreshing = false;

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          function () {
            if (refreshing) {
              return;
            }

            refreshing = true;
            window.location.reload();
          }
        );
      } catch (error) {
        console.error(
          "Service Worker error:",
          error
        );
      }
    }
  );
}
