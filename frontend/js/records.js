let currentId = null;
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./index.html";
}

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const countText = document.getElementById("countText");
const recordBody = document.getElementById("recordBody");
const emptyMessage = document.getElementById("emptyMessage");

const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const copyBtn = document.getElementById("copyBtn");
const viewFileBtn = document.getElementById("viewFileBtn");

let allRecords = [];
let currentHash = "";

if (localStorage.getItem("userRole") !== "admin") {
  document.querySelectorAll(".admin-only").forEach(function (item) {
    item.style.display = "none";
  });
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

function shortHash(hash) {
  return "0x" + hash.slice(0, 6) + "…" + hash.slice(-6);
}

function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;

  const shown = allRecords.filter(function (rec) {
    const matchesType = type === "" || rec.type === type;
    const text = (
      rec.student +
      " " +
      rec.studentNo +
      " " +
      rec.hash
    ).toLowerCase();
    return matchesType && text.includes(keyword);
  });

  recordBody.innerHTML = "";
  emptyMessage.textContent = "No records found.";
  emptyMessage.hidden = shown.length > 0;
  countText.textContent =
    shown.length + " of " + allRecords.length + " records";

  shown.forEach(function (rec) {
    const tr = document.createElement("tr");

    tr.appendChild(makeCell(rec.student));
    tr.appendChild(makeCell(rec.studentNo));
    tr.appendChild(makeCell(rec.type));
    tr.appendChild(makeCell(rec.date));

    const hashCell = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = shortHash(rec.hash);
    hashCell.appendChild(code);
    tr.appendChild(hashCell);

    const actionCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "view-btn";
    btn.textContent = "View";
    btn.addEventListener("click", function () {
      openDetails(rec);
    });
    actionCell.appendChild(btn);
    tr.appendChild(actionCell);

    recordBody.appendChild(tr);
  });
}

function openDetails(rec) {
  document.getElementById("dStudent").textContent = rec.student;
  document.getElementById("dStudentNo").textContent = rec.studentNo;
  document.getElementById("dType").textContent = rec.type;
  document.getElementById("dDate").textContent = rec.date;
  document.getElementById("dFile").textContent = rec.fileName || "-";
  document.getElementById("dRegistered").textContent = String(rec.registeredAt);
  document.getElementById("dBlock").textContent = rec.block || "-";
  document.getElementById("dTx").textContent = rec.txHash || "-";
  document.getElementById("dHash").textContent = "0x" + rec.hash;

  currentHash = "0x" + rec.hash;
  copyBtn.innerHTML =
    '<span class="material-symbols-outlined">content_copy</span> Copy Hash';
  currentId = rec.id;
  viewFileBtn.disabled = !rec.hasFile;
  viewFileBtn.innerHTML = rec.hasFile
    ? '<span class="material-symbols-outlined">visibility</span> View File'
    : "No file stored for this record";
  modal.hidden = false;
}

function closeDetails() {
  modal.hidden = true;
}

closeModal.addEventListener("click", closeDetails);

modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    closeDetails();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeDetails();
  }
});

copyBtn.addEventListener("click", async function () {
  try {
    await navigator.clipboard.writeText(currentHash);
    copyBtn.textContent = "Copied!";
  } catch (error) {
    copyBtn.textContent = "Press Ctrl + C to copy manually";
  }
});

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);

async function loadRecords() {
  try {
    const response = await fetch("http://localhost:3000/api/documents", {
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

    allRecords = data;
    render();
  } catch (error) {
    console.error(error);
    emptyMessage.textContent = "Error: " + error.message;
    emptyMessage.hidden = false;
  }
}

viewFileBtn.addEventListener("click", async function () {
  const tab = window.open("", "_blank");

  try {
    const response = await fetch(
      "http://localhost:3000/api/documents/" + currentId + "/file",
      { headers: { Authorization: "Bearer " + token } },
    );

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "./index.html";
      return;
    }

    if (!response.ok) {
      const data = await response.json();
      if (tab) tab.close();
      showToast(data.message, "error");
      return;
    }

    const intact = response.headers.get("X-File-Intact") === "true";
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (tab) {
      tab.location.href = url;
    } else {
      showToast(
        "Your browser blocked the new tab. Allow pop-ups and try again.",
        "error",
      );
    }

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 60000);

    if (intact) {
      showToast("File matches its registered hash.", "success");
    } else {
      showToast(
        "WARNING: this file no longer matches its registered hash.",
        "error",
      );
    }
  } catch (error) {
    console.error(error);
    if (tab) tab.close();
    showToast("Cannot load the file. Is the backend running?", "error");
  }
});

loadRecords();
