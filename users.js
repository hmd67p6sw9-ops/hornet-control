/* Hornet Control — Users Management (RC2) */

let usersCache = [];
let editingUserId = "";

const ROLE_LABELS = {
  ADMIN: "Адміністратор",
  WAREHOUSE: "Склад",
  CLERK: "Обліковець",
  COMBAT: "Бойовий підрозділ"
};

function openUsersModal() {
  closeAdminMenu();

  document.getElementById("usersModal").classList.remove("hidden");
  loadUsers();
}

function closeUsersModal() {
  document.getElementById("usersModal").classList.add("hidden");
}

function loadUsers() {
  const container = document.getElementById("usersList");

  container.innerHTML = '<div class="no-items">Завантаження…</div>';
  hideGenericMessage("usersMessage");

  apiRequest(
    {
      action: "listUsers"
    },
    function (response) {
      if (!response.ok || !response.users) {
        container.innerHTML =
          '<div class="no-items">Не вдалося завантажити список</div>';

        showGenericMessage(
          "usersMessage",
          response.error || "Помилка завантаження користувачів",
          "error"
        );

        return;
      }

      usersCache = response.users;
      renderUsersList(usersCache);
    }
  );
}

function renderUsersList(users) {
  const container = document.getElementById("usersList");

  container.innerHTML = "";

  if (!users.length) {
    container.innerHTML = '<div class="no-items">Немає користувачів</div>';
    return;
  }

  users.forEach(function (user) {
    const row = document.createElement("div");
    row.className = "diagnostics-sheet-row";

    const main = document.createElement("div");
    main.className = "diagnostics-sheet-main";
    main.style.cursor = "pointer";
    main.onclick = function () {
      openEditUserModal(user.userId);
    };

    const name = document.createElement("strong");
    name.textContent = user.name;

    const meta = document.createElement("span");
    meta.textContent =
      (ROLE_LABELS[user.role] || user.role) + " • " + user.email;

    main.appendChild(name);
    main.appendChild(meta);

    const badge = document.createElement("span");
    badge.className = user.active
      ? "diagnostics-badge diagnostics-badge-ok"
      : "diagnostics-badge diagnostics-badge-warning";
    badge.textContent = user.active ? "Активний" : "Вимкнено";

    row.appendChild(main);
    row.appendChild(badge);
    container.appendChild(row);
  });
}

function openCreateUserModal() {
  editingUserId = "";

  document.getElementById("userFormTitle").textContent = "Новий користувач";
  document.getElementById("userFormEmail").value = "";
  document.getElementById("userFormEmail").disabled = false;
  document.getElementById("userFormName").value = "";
  document.getElementById("userFormRole").value = "WAREHOUSE";
  document.getElementById("userFormComment").value = "";
  document.getElementById("userFormPin").value = "";
  document.getElementById("userFormPinLabel").textContent = "PIN (4–6 цифр)";
  document.getElementById("userFormActiveRow").classList.add("hidden");

  hideGenericMessage("userFormMessage");
  document.getElementById("userFormModal").classList.remove("hidden");
}

function openEditUserModal(userId) {
  const user = usersCache.find(function (item) {
    return item.userId === userId;
  });

  if (!user) {
    return;
  }

  editingUserId = userId;

  document.getElementById("userFormTitle").textContent = "Редагування користувача";
  document.getElementById("userFormEmail").value = user.email;
  document.getElementById("userFormEmail").disabled =
    user.email === "asghornetcontrol@gmail.com";
  document.getElementById("userFormName").value = user.name;
  document.getElementById("userFormRole").value = user.role;
  document.getElementById("userFormComment").value = user.comment || "";
  document.getElementById("userFormPin").value = "";
  document.getElementById("userFormPinLabel").textContent =
    "Новий PIN (залиш порожнім, щоб не змінювати)";

  document.getElementById("userFormActiveRow").classList.remove("hidden");
  document.getElementById("userFormActiveCheckbox").checked = user.active;

  hideGenericMessage("userFormMessage");
  document.getElementById("userFormModal").classList.remove("hidden");
}

function closeUserFormModal() {
  document.getElementById("userFormModal").classList.add("hidden");
}

function submitUserForm() {
  const email = document.getElementById("userFormEmail").value.trim();
  const name = document.getElementById("userFormName").value.trim();
  const role = document.getElementById("userFormRole").value;
  const comment = document.getElementById("userFormComment").value.trim();
  const pin = document.getElementById("userFormPin").value.trim();
  const button = document.getElementById("userFormSaveButton");

  hideGenericMessage("userFormMessage");

  if (!email || !name) {
    showGenericMessage("userFormMessage", "Заповни email та ім'я", "error");
    return;
  }

  if (pin && !/^\d{4,6}$/.test(pin)) {
    showGenericMessage("userFormMessage", "PIN має бути 4–6 цифр", "error");
    return;
  }

  button.disabled = true;

  if (!editingUserId) {
    if (!pin) {
      showGenericMessage("userFormMessage", "Встанови PIN для нового користувача", "error");
      button.disabled = false;
      return;
    }

    apiRequest(
      {
        action: "createUser",
        email: email,
        name: name,
        role: role,
        active: "true",
        comment: comment,
        pin: pin
      },
      function (response) {
        button.disabled = false;
        handleUserFormResponse(response);
      }
    );

    return;
  }

  const active = document.getElementById("userFormActiveCheckbox").checked;

  apiRequest(
    {
      action: "updateUser",
      userId: editingUserId,
      email: email,
      name: name,
      role: role,
      comment: comment
    },
    function (updateResponse) {
      if (!updateResponse.ok) {
        button.disabled = false;
        handleUserFormResponse(updateResponse);
        return;
      }

      apiRequest(
        {
          action: "setUserActive",
          userId: editingUserId,
          active: String(active)
        },
        function (activeResponse) {
          if (!activeResponse.ok || !pin) {
            button.disabled = false;
            handleUserFormResponse(activeResponse.ok ? updateResponse : activeResponse);
            return;
          }

          apiRequest(
            {
              action: "setUserPin",
              email: email,
              pin: pin
            },
            function (pinResponse) {
              button.disabled = false;
              handleUserFormResponse(pinResponse.ok ? updateResponse : pinResponse);
            }
          );
        }
      );
    }
  );
}

function handleUserFormResponse(response) {
  if (!response.ok) {
    showGenericMessage(
      "userFormMessage",
      response.error || "Не вдалося зберегти",
      "error"
    );
    return;
  }

  closeUserFormModal();
  loadUsers();
}