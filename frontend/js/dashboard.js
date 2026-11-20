const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./index.html";
}

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const searchInput = document.getElementById("searchInput");
const logoutBtn = document.getElementById("logoutBtn");
const todayDate = document.getElementById("todayDate");

const docBody = document.getElementById("docBody");
const emptyDocs = document.getElementById("emptyDocs");
const activityList = document.getElementById("activityList");
const emptyActivity = document.getElementById("emptyActivity");

const API = "http://localhost:3000/api";

todayDate.textContent = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const loggedName = localStorage.getItem("firstName");
const loggedEmail = localStorage.getItem("userEmail");
const loggedRole = localStorage.getItem("userRole");

if (loggedName) {
  document.getElementById("firstName").textContent = loggedName;
  document.getElementById("userName").textContent =
    loggedName + (loggedRole === "admin" ? " (Admin)" : " (Staff)");
  document.getElementById("userAvatar").textContent = loggedName
    .charAt(0)
    .toUpperCase();
}

if (loggedEmail) {
  document.getElementById("userEmail").textContent = loggedEmail;
}

if (loggedRole !== "admin") {
  document.querySelectorAll(".admin-only").forEach(function (item) {
    item.style.display = "none";
  });
}

menuBtn.addEventListener("click", function () {
  sidebar.classList.toggle("open");
});

searchInput.addEventListener("input", function () {
  const keyword = searchInput.value.toLowerCase();
  document.querySelectorAll("#docBody tr").forEach(function (row) {
    row.style.display = row.textContent.toLowerCase().includes(keyword)
      ? ""
      : "none";
  });
});

logoutBtn.addEventListener("click", function (event) {
  if (!confirm("Are you sure you want to log out?")) {
    event.preventDefault();
    return;
  }
  localStorage.clear();
});

async function api(path) {
  const response = await fetch(API + path, {
    headers: { Authorization: "Bearer " + token },
  });

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "./index.html";
    throw new Error("Session expired.");
  }

  return response.json();
}

function makeCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function shortHash(hash) {
  return "0x" + hash.slice(0, 4) + "…" + hash.slice(-4);
}

function timeAgo(dateString) {
  const then = new Date(String(dateString).replace(" ", "T"));
  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);

  if (isNaN(minutes)) return "";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes + " minutes ago";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " hours ago";

  return Math.floor(hours / 24) + " days ago";
}

async function loadStats() {
  try {
    const stats = await api("/stats");
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statToday").textContent = stats.today;
    document.getElementById("statMonth").textContent = stats.month;
    document.getElementById("statTypes").textContent = stats.types;
  } catch (error) {
    console.error(error);

    async function loadChainStatus() {
      try {
        const s = await api("/chain-status");
        const connected = s.network !== "Not connected";

        document.getElementById("chainState").textContent = connected
          ? "Connected"
          : "Offline";
        document.getElementById("chainNetwork").textContent = s.network;
        document.getElementById("chainBlock").textContent = "#" + s.block;
        document.getElementById("chainTotal").textContent = s.total;
        document.getElementById("chainContract").textContent =
          s.contract.length > 12
            ? s.contract.slice(0, 6) + "…" + s.contract.slice(-4)
            : s.contract;
      } catch (error) {
        console.error(error);
        document.getElementById("chainState").textContent = "Offline";
      }
    }

    loadChainStatus();
  }
}

async function loadDocuments() {
  try {
    const docs = await api("/documents");
    const recent = docs.slice(0, 5);

    docBody.innerHTML = "";
    activityList.innerHTML = "";
    emptyDocs.hidden = recent.length > 0;
    emptyActivity.hidden = recent.length > 0;

    recent.forEach(function (doc) {
      const tr = document.createElement("tr");
      tr.appendChild(makeCell(doc.type));
      tr.appendChild(makeCell(doc.student));

      const hashCell = document.createElement("td");
      const code = document.createElement("code");
      code.textContent = shortHash(doc.hash);
      hashCell.appendChild(code);
      tr.appendChild(hashCell);

      tr.appendChild(makeCell(doc.date));

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "badge verified";
      badge.textContent = "Registered";
      statusCell.appendChild(badge);
      tr.appendChild(statusCell);

      docBody.appendChild(tr);

      const li = document.createElement("li");
      const dot = document.createElement("i");
      dot.className = "a-dot";

      const box = document.createElement("div");
      const text = document.createElement("p");
      text.textContent = doc.type + " registered for " + doc.student;
      const small = document.createElement("small");
      small.textContent = timeAgo(doc.registeredAt);

      box.appendChild(text);
      box.appendChild(small);
      li.appendChild(dot);
      li.appendChild(box);
      activityList.appendChild(li);
    });
  } catch (error) {
    console.error(error);
    emptyDocs.textContent = "Cannot load documents. Is the backend running?";
    emptyDocs.hidden = false;

    async function loadChainStatus() {
      try {
        const s = await api("/chain-status");
        const connected = s.network !== "Not connected";

        document.getElementById("chainState").textContent = connected
          ? "Connected"
          : "Offline";
        document.getElementById("chainNetwork").textContent = s.network;
        document.getElementById("chainBlock").textContent = "#" + s.block;
        document.getElementById("chainTotal").textContent = s.total;
        document.getElementById("chainContract").textContent =
          s.contract.length > 12
            ? s.contract.slice(0, 6) + "…" + s.contract.slice(-4)
            : s.contract;
      } catch (error) {
        console.error(error);
        document.getElementById("chainState").textContent = "Offline";
      }
    }

    loadChainStatus();
  }
}

loadStats();
loadDocuments();
