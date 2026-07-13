/* Hornet Control v1.5.0-alpha2 */

const API_REQUEST_TIMEOUT_MS = 20000;

function apiRequest(parameters, callback) {
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

    callback(response);
  }

  window[callbackName] = function (response) {
    finish(response);
  };

  const query = new URLSearchParams({
    ...parameters,
    key: API_KEY,
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
        "Не вдалося з’єднатися з Apps Script. Перевір URL, доступ до Web App і публікацію останньої версії."
    });
  };

  const timeoutId = setTimeout(function () {
    finish({
      ok: false,
      error:
        "Apps Script не відповів за 20 секунд. Перевір, що Web App опублікований для доступу «Anyone» і що використовується актуальний /exec URL."
    });
  }, API_REQUEST_TIMEOUT_MS);

  document.body.appendChild(script);
}
