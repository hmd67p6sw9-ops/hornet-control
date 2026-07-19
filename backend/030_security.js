function normalizePermission_(permission) {
  const normalizedPermission = String(permission || "")
    .trim()
    .toUpperCase();

  const validPermissions = Object.keys(PERMISSIONS).map(function (key) {
    return PERMISSIONS[key];
  });

  if (!validPermissions.includes(normalizedPermission)) {
    throw new Error("Невідомий дозвіл: " + normalizedPermission);
  }

  return normalizedPermission;
}


let CURRENT_SESSION_USER_ = null;


function getCurrentUser_(email) {
  const requestedEmail = normalizeUserEmail_(email);

  if (!requestedEmail && CURRENT_SESSION_USER_) {
    return CURRENT_SESSION_USER_;
  }

  let resolvedEmail = requestedEmail;

  if (!resolvedEmail) {
    try {
      resolvedEmail = normalizeUserEmail_(
        Session.getActiveUser().getEmail()
      );
    } catch (error) {
      resolvedEmail = "";
    }
  }

  if (!resolvedEmail && !SECURITY_ENFORCEMENT_ENABLED) {
    resolvedEmail = BOOTSTRAP_ADMIN_EMAIL;
  }

  if (!resolvedEmail) {
    return null;
  }

  return findUserByEmail_(getUsersSheet_(), resolvedEmail);
}


function getCurrentUserRole_(email) {
  const user = getCurrentUser_(email);

  if (!user || !user.active) {
    return "";
  }

  return normalizeUserRole_(user.role);
}


function getRolePermissions_(role) {
  const normalizedRole = normalizeUserRole_(role);

  return (ROLE_PERMISSIONS[normalizedRole] || []).slice();
}


function hasPermission_(userOrRole, permission) {
  const normalizedPermission = normalizePermission_(permission);
  let role = "";
  let active = true;

  if (typeof userOrRole === "string") {
    role = normalizeUserRole_(userOrRole);
  } else if (userOrRole && typeof userOrRole === "object") {
    role = normalizeUserRole_(userOrRole.role);
    active = userOrRole.active !== false;
  } else {
    const currentUser = getCurrentUser_();

    if (!currentUser) {
      return false;
    }

    role = normalizeUserRole_(currentUser.role);
    active = currentUser.active;
  }

  if (!active) {
    return false;
  }

  return getRolePermissions_(role).includes(normalizedPermission);
}


function requirePermission_(permission, user) {
  const normalizedPermission = normalizePermission_(permission);
  const currentUser = user || getCurrentUser_();

  if (!SECURITY_ENFORCEMENT_ENABLED) {
    return {
      allowed: true,
      compatibilityMode: true,
      permission: normalizedPermission,
      user: currentUser
    };
  }

  if (!currentUser || !currentUser.active) {
    appendAuditLog_(
      currentUser ? currentUser.email : "",
      currentUser ? currentUser.userId : "",
      currentUser ? currentUser.role : "",
      "ACCESS_DENIED",
      "PERMISSION",
      normalizedPermission,
      "DENIED",
      {
        reason: currentUser ? "USER_DISABLED" : "USER_NOT_FOUND"
      }
    );

    throw new Error("Доступ заборонено");
  }

  if (!hasPermission_(currentUser, normalizedPermission)) {
    appendAuditLog_(
      currentUser.email,
      currentUser.userId,
      currentUser.role,
      "ACCESS_DENIED",
      "PERMISSION",
      normalizedPermission,
      "DENIED",
      {
        reason: "MISSING_PERMISSION"
      }
    );

    throw new Error("Недостатньо прав для виконання дії");
  }

  return {
    allowed: true,
    compatibilityMode: false,
    permission: normalizedPermission,
    user: currentUser
  };
}


function getPermissionEngineStatus_() {
  return {
    enforcementEnabled: SECURITY_ENFORCEMENT_ENABLED,
    roles: USER_ROLES.slice(),
    permissions: Object.keys(PERMISSIONS).map(function (key) {
      return PERMISSIONS[key];
    }),
    rolePermissions: {
      ADMIN: getRolePermissions_("ADMIN"),
      WAREHOUSE: getRolePermissions_("WAREHOUSE"),
      CLERK: getRolePermissions_("CLERK"),
      COMBAT: getRolePermissions_("COMBAT")
    }
  };
}
