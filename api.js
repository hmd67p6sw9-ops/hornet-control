/* Hornet Control v1.6.0-RC1 */

const API_REQUEST_TIMEOUT_MS = 20000;
const CONNECTION_RESTORED_MESSAGE_MS = 2500;

let connectionRestoredTimer = null;

function getConnectionStatusElement() {
  return document.getElementById("connectionStatus");
}

function showConnectionStatus(message, type) {
  const element = getConnectionStatusElement();

  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = "connection-status " + type;
}

function hideConnectionStatus() {
  const element = getConnectionStatusElement();

  if (!element) {
    return;
  }

  element.textContent = "";
  element.className = "connection-status hidden";
}

function updateConnectionStatus() {
  if (!navigator.onLine) {
    clearTimeout(connectionRestoredTimer);
    showConnectionStatus(
      "Немає з’єднання з інтернетом. Перегляд доступний, але зміни не збережуться.",
      "offline"
    );
    return;
  }

  showConnectionStatus("З’єднання відновлено", "restored");

  clearTimeout(connectionRestoredTimer);
  connectionRestoredTimer = setTimeout(function () {
    hideConnectionStatus();
  }, CONNECTION_RESTORED_MESSAGE_MS);
}

window.addEventListener("offline", updateConnectionStatus);
window.addEventListener("online", updateConnectionStatus);

window.addEventListener("DOMContentLoaded", function () {
  if (!navigator.onLine) {
    updateConnectionStatus();
  }
});

function isSessionInvalidError_(response) {
  const message = String((response && response.error) || "");
  return (
    message.indexOf("Сесія недійсна") !== -1 ||
    message.indexOf("Сесію не знайдено") !== -1
  );
}

function apiRequest(parameters, callback) {
  if (!navigator.onLine) {
    updateConnectionStatus();

    callback({
      ok: false,
      error:
        "Немає з’єднання з інтернетом. Підключись до мережі та повтори операцію."
    });

    return;
  }

  const callbackName =
    "hcCallback_" +
    Date.now() +
    "_" +
    Math.floor(Math.random() * 100000);

  const script = document.createElement("script");
  let completed = false;

  function cleanup() {
    if (window[callbackName]) {
      delete window[callbackName];
    }

    if (script.parentNode) {
      script.remove();
    }
  }

  function finish(response) {
    if (completed) {
      return;
    }

    completed = true;
    clearTimeout(timeoutId);
    cleanup();

    if (
      response &&
      response.ok === false &&
      isSessionInvalidError_(response) &&
      parameters.action !== "getCurrentSession" &&
      parameters.action !== "login"
    ) {
      setStoredSessionToken("");

      if (typeof showLoginScreen === "function") {
        showLoginScreen();
        loadLoginableUsers();
      }
    }

    callback(response);
  }

  window[callbackName] = function (response) {
    finish(response);
  };

  const query = new URLSearchParams({
    ...parameters,
    key: API_KEY,
    token: getStoredSessionToken(),
    callback: callbackName,
    _: Date.now().toString()
  });

  const separator = API_URL.includes("?") ? "&" : "?";

  script.src = API_URL + separator + query.toString();
  script.async = true;

  script.onerror = function () {
    finish({
      ok: false,
      error:
        "Не вдалося з’єднатися з Apps Script. Перевір інтернет, URL Web App і публікацію останньої версії."
    });
  };

  const timeoutId = setTimeout(function () {
    finish({
      ok: false,
      error:
        "Apps Script не відповів за 20 секунд. Перевір з’єднання, доступ «Anyone» і актуальний /exec URL."
    });
  }, API_REQUEST_TIMEOUT_MS);

  document.body.appendChild(script);
}
