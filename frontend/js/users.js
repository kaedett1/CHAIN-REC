// ========== Must be logged in as admin ==========
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./index.html";
}

if (localStorage.getItem("userRole") !== "admin") {
  window.location.href = "./dashboard.html";
}

// ========== Get elements ==========
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

const userTable = document.getElementById("userTable");
const emptyMessage = document.getElementById("emptyMessage");

const form = document.getElementById("userForm");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const email = document.getElementById("email");
const password = document.getElementById("password");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

const API = "http://localhost:3000/api/users";

// ========== Sidebar and logout ==========
menuBtn.addEventListener("click", function () {
  sidebar.classList.toggle("open");
});

logoutBtn.addEventListener("click", function (event) {
  if (!confirm("Are you sure you want to log out?")) {
    event.preventDefault();
    return;
  }
  localStorage.clear();
});

// ========== Helper: call the backend with the token ==========
async function api(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
  });

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "./index.html";
    throw new Error("Session expired.");
  }

  const data = await response.json();
  return { ok: response.ok, data: data };
}

// ========== Show a message under the form ==========
function showMessage(text, good) {
  formMessage.textContent = text;
  formMessage.className = good ? "message ok" : "message";
}

// ========== Build table cells ==========
function makeCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function makeBadge(text, cssClass) {
  const td = document.createElement("td");
  const span = document.createElement("span");
  span.className = "badge " + cssClass;
  span.textContent = text;
  td.appendChild(span);
  return td;
}

// ========== Load and show all accounts ==========
async function loadUsers() {
  try {
    const result = await api(API, { method: "GET" });

    if (!result.ok) {
      emptyMessage.textContent = result.data.message;
      emptyMessage.hidden = false;
      return;
    }

    userTable.innerHTML = "";
    emptyMessage.hidden = result.data.length > 0;

    result.data.forEach(function (user) {
      const tr = document.createElement("tr");

      tr.appendChild(makeCell(user.firstName + " " + user.lastName));
      tr.appendChild(makeCell(user.email));
      tr.appendChild(makeBadge(user.role, user.role));
      tr.appendChild(
        makeBadge(
          user.isActive ? "Active" : "Disabled",
          user.isActive ? "active" : "inactive",
        ),
      );

      const actionCell = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.textContent = user.isActive ? "Disable" : "Enable";
      btn.addEventListener("click", function () {
        changeStatus(user.id, !user.isActive);
      });
      actionCell.appendChild(btn);
      tr.appendChild(actionCell);

      userTable.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    emptyMessage.textContent = "Cannot connect to the server.";
    emptyMessage.hidden = false;
  }
}

// ========== Enable or disable ==========
async function changeStatus(id, isActive) {
  const word = isActive ? "enable" : "disable";
  if (!confirm("Are you sure you want to " + word + " this account?")) return;

  try {
    const result = await api(API + "/" + id + "/status", {
      method: "PATCH",
      body: JSON.stringify({ isActive: isActive }),
    });

    if (!result.ok) {
      alert(result.data.message);
      return;
    }

    loadUsers();
  } catch (error) {
    console.error(error);
  }
}

// ========== Create a staff account ==========
form.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (firstName.value.trim() === "" || lastName.value.trim() === "") {
    showMessage("Please enter the first and last name.", false);
    return;
  }

  if (email.value.trim() === "" || !email.value.includes("@")) {
    showMessage("Please enter a valid email.", false);
    return;
  }

  if (password.value.length < 8) {
    showMessage("Password must be at least 8 characters.", false);
    return;
  }

  submitBtn.disabled = true;

  try {
    const result = await api(API, {
      method: "POST",
      body: JSON.stringify({
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: email.value.trim(),
        password: password.value,
      }),
    });

    if (!result.ok) {
      showMessage(result.data.message, false);
    } else {
      showMessage("Staff account created.", true);
      form.reset();
      loadUsers();
    }
  } catch (error) {
    console.error(error);
    showMessage("Cannot connect to the server.", false);
  }

  submitBtn.disabled = false;
});

loadUsers();
