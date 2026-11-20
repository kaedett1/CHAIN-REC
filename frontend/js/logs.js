const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./index.html";
}

const role = localStorage.getItem("userRole");

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

const scopeNote = document.getElementById("scopeNote");
const searchInput = document.getElementById("searchInput");
const actionFilter = document.getElementById("actionFilter");
const countText = document.getElementById("countText");
const logBody = document.getElementById("logBody");
const emptyMessage = document.getElementById("emptyMessage");

let allLogs = [];

const ACTIONS = {
  LOGIN: { label: "Login", style: "info" },
  LOGIN_FAILED: { label: "Failed login", style: "danger" },
  REGISTER_DOCUMENT: { label: "Document registered", style: "good" },
  VERIFY_AUTHENTIC: { label: "Verified: authentic", style: "good" },
  VERIFY_NOT_FOUND: { label: "Verified: not found", style: "warn" },
  CREATE_USER: { label: "Account created", style: "info" },
  DISABLE_USER: { label: "Account disabled", style: "danger" },
  ENABLE_USER: { label: "Account enabled", style: "good" },
  VIEW_FILE: { label: "File viewed", style: "info" },
};

if (role !== "admin") {
  document.querySelectorAll(".admin-only").forEach(function (item) {
    item.style.display = "none";
  });
  scopeNote.textContent = "You are viewing your own activity only.";
} else {
  scopeNote.textContent = "You are viewing the activity of all users.";
}

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

function makeCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  const action = actionFilter.value;

  const shown = allLogs.filter(function (log) {
    const matchesAction = action === "" || log.action === action;
    const text = (log.userName + " " + (log.details || "")).toLowerCase();
    return matchesAction && text.includes(keyword);
  });

  logBody.innerHTML = "";
  emptyMessage.textContent = "No activity found.";
  emptyMessage.hidden = shown.length > 0;
  countText.textContent = shown.length + " of " + allLogs.length + " entries";

  shown.forEach(function (log) {
    const tr = document.createElement("tr");

    tr.appendChild(makeCell(String(log.createdAt)));
    tr.appendChild(makeCell(log.userName));

    const info = ACTIONS[log.action] || { label: log.action, style: "info" };
    const actionCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge " + info.style;
    badge.textContent = info.label;
    actionCell.appendChild(badge);
    tr.appendChild(actionCell);

    const detailsCell = makeCell(log.details || "-");
    detailsCell.className = "details";
    tr.appendChild(detailsCell);

    logBody.appendChild(tr);
  });
}

searchInput.addEventListener("input", render);
actionFilter.addEventListener("change", render);

async function loadLogs() {
  try {
    const response = await fetch("http://localhost:3000/api/logs", {
      headers: { Authorization: "Bearer " + token },
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "./index.html";
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      emptyMessage.textContent = "Server says: " + data.message;
      emptyMessage.hidden = false;
      return;
    }

    allLogs = data;
    render();
  } catch (error) {
    console.error(error);
    emptyMessage.textContent = "Error: " + error.message;
    emptyMessage.hidden = false;
  }
}

loadLogs();
