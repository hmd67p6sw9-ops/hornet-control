/* Hornet Control — Login Screen (Module 2: Session API) */

const SESSION_TOKEN_STORAGE_KEY = "hcSessionToken";

let currentSessionInfo = null;


function getStoredSessionToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "";
  } catch (error) {
    return "";
  }
}


function setStoredSessionToken(token) {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Session storage error:", error);
  }
}


function showLoginScreen() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appRoot").classList.add("hidden");
}


function hideLoginScreen() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appRoot").classList.remove("hidden");
}


function checkSessionAndInit() {
  const token = getStoredSessionToken();

  if (!token) {
    showLoginScreen();
    loadLoginableUsers();
    return;
  }

  apiRequest(
    {
      action: "getCurrentSession",
      token: token
    },
    function (response) {
      if (!response.ok || !response.session) {
        setStoredSessionToken("");
        showLoginScreen();
        loadLoginableUsers();
        return;
      }

      currentSessionInfo = response.session;
      hideLoginScreen();
      initializeApplication();
    }
  );
}


function loadLoginableUsers() {
  const select = document.getElementById("loginEmailSelect");
  const button = document.getElementById("loginButton");

  select.innerHTML = '<option value="">Завантаження…</option>';
  button.disabled = true;

  apiRequest(
    {
      action: "listLoginableUsers"
    },
    function (response) {
      if (!response.ok || !response.users || !response.users.length) {
        select.innerHTML =
          '<option value="">Немає доступних користувачів</option>';

        showGenericMessage(
          "loginMessage",
          response.error || "Не вдалося завантажити список користувачів",
          "error"
        );

        return;
      }

      select.innerHTML = response.users
        .map(function (user) {
          return (
            '<option value="' +
            String(user.email).replace(/"/g, "&quot;") +
            '">' +
            String(user.name || user.email) +
            " (" +
            String(user.role) +
            ")</option>"
          );
        })
        .join("");

      button.disabled = false;
    }
  );
}


function submitLogin() {
  const select = document.getElementById("loginEmailSelect");
  const button = document.getElementById("loginButton");
  const email = select.value;

  hideGenericMessage("loginMessage");

  if (!email) {
    showGenericMessage("loginMessage", "Обери користувача зі списку", "error");
    return;
  }

  button.disabled = true;

  apiRequest(
    {
      action: "login",
      email: email,
      clientInfo: navigator.userAgent
    },
    function (response) {
      button.disabled = false;

      if (!response.ok || !response.session) {
        showGenericMessage(
          "loginMessage",
          response.error || "Не вдалося увійти",
          "error"
        );
        return;
      }

      setStoredSessionToken(response.session.token);
      currentSessionInfo = response.session;

      hideLoginScreen();
      initializeApplication();
    }
  );
}


function performLogout() {
  const token = getStoredSessionToken();

  closeAdminMenu();

  apiRequest(
    {
      action: "logout",
      token: token
    },
    function () {
      setStoredSessionToken("");
      currentSessionInfo = null;
      window.location.reload();
    }
  );
}