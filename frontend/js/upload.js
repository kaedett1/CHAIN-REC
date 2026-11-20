if (!localStorage.getItem("token")) {
  window.location.href = "./index.html";
}

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

const form = document.getElementById("uploadForm");
const studentName = document.getElementById("studentName");
const studentNo = document.getElementById("studentNo");
const docType = document.getElementById("docType");
const dateIssued = document.getElementById("dateIssued");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const clearBtn = document.getElementById("clearBtn");
const hashBox = document.getElementById("hashBox");
const hashValue = document.getElementById("hashValue");

const errorMessage = document.getElementById("errorMessage");
const submitBtn = document.getElementById("submitBtn");
const successCard = document.getElementById("successCard");
const successText = document.getElementById("successText");

let selectedFile = null;
let currentHash = "";

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

dropzone.addEventListener("click", function () {
  fileInput.click();
});

dropzone.addEventListener("dragover", function (event) {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", function () {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", function (event) {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  if (event.dataTransfer.files.length > 0) {
    setFile(event.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", function () {
  if (fileInput.files.length > 0) {
    setFile(fileInput.files[0]);
  }
});

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

async function setFile(file) {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = (file.size / 1024).toFixed(1) + " KB";
  fileInfo.hidden = false;
  successCard.hidden = true;
  errorMessage.textContent = "";

  currentHash = await hashFile(file);
  hashValue.textContent = "0x" + currentHash;
  hashBox.hidden = false;
}

clearBtn.addEventListener("click", function () {
  selectedFile = null;
  currentHash = "";
  fileInput.value = "";
  fileInfo.hidden = true;
  hashBox.hidden = true;
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (studentName.value.trim() === "") {
    errorMessage.textContent = "Please enter the student name.";
    return;
  }

  if (studentNo.value.trim() === "") {
    errorMessage.textContent = "Please enter the student number.";
    return;
  }

  if (docType.value === "") {
    errorMessage.textContent = "Please select a document type.";
    return;
  }

  if (dateIssued.value === "") {
    errorMessage.textContent = "Please choose the date issued.";
    return;
  }

  if (!selectedFile || currentHash === "") {
    errorMessage.textContent = "Please choose a document file.";
    return;
  }

  errorMessage.textContent = "";
  submitBtn.disabled = true;

  const record = {
    student: studentName.value.trim(),
    studentNo: studentNo.value.trim(),
    type: docType.value,
    date: dateIssued.value,
    fileName: selectedFile.name,
    hash: currentHash,
  };

  try {
    const response = await fetch("http://localhost:3000/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(record),
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "./index.html";
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      errorMessage.textContent = data.message;
      submitBtn.disabled = false;
      return;
    }

    successText.textContent =
      record.type +
      " for " +
      record.student +
      " was registered on the blockchain." +
      "\nBlock: " +
      data.block +
      "\nTransaction: " +
      data.txHash +
      "\nHash: 0x" +
      record.hash;
    successCard.hidden = false;

    form.reset();
    selectedFile = null;
    currentHash = "";
    fileInput.value = "";
    fileInfo.hidden = true;
    hashBox.hidden = true;
  } catch (error) {
    console.error(error);
    errorMessage.textContent = "Error: " + error.message;
  }

  submitBtn.disabled = false;
});

if (localStorage.getItem("userRole") !== "admin") {
  document.querySelectorAll(".admin-only").forEach(function (item) {
    item.style.display = "none";
  });
}
