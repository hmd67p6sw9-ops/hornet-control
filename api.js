/* Hornet Control v1.5.0-alpha1 */

function apiRequest(parameters, callback) {
  const callbackName =
    "hcCallback_" +
    Date.now() +
    "_" +
    Math.floor(Math.random() * 100000);

  const script =
    document.createElement("script");

  window[callbackName] = function (response) {
    try {
      callback(response);
    } finally {
      delete window[callbackName];
      script.remove();
    }
  };

  const query = new URLSearchParams({
    ...parameters,
    key: API_KEY,
    callback: callbackName
  });

  script.src =
    API_URL + "?" + query.toString();

  script.onerror = function () {
    delete window[callbackName];
    script.remove();

    callback({
      ok: false,
      error:
        "Не вдалося з’єднатися з Google Sheets."
    });
  };

  document.body.appendChild(script);
}
