const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const clearBtn = document.getElementById("clearBtn");
const verifyBtn = document.getElementById("verifyBtn");
const result = document.getElementById("result");
const resultSymbol = document.getElementById("resultSymbol");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const hashValue = document.getElementById("hashValue");
const previewBox = document.getElementById("previewBox");

verifyBtn.addEventListener("click", async function () {
  if (!selectedFile) return;

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Checking...";

  const hash = await hashFile(selectedFile);
  hashValue.textContent = "0x" + hash;
  result.hidden = false;

  try {
    const respone = await fetch("http://localhost:3000/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: hash }),
    });

    const data = await respone.json();

    if (data.found) {
      result.className = "result success";
      resultSymbol.textContent = "check_circle";
      resultTitle.textContent = "Authentic";
      resultText.textContent =
        "This " +
        data.type +
        " matches a record stored on the blockchain" +
        (data.registeredOn
          ? " since " + new Date(data.registeredOn).toLocaleString()
          : "") +
        ". It has not been altered.";
    } else {
      result.className = "result fail";
      resultSymbol.textContent = "cancel";
      resultTitle.textContent = "Not Found";
      resultText.textContent =
        "No matching record was found. THe document may be altered, or it was never issued by the Registrar's Office.";
    }
  } catch (error) {
    result.className = "result fail";
    ((resultSymbol.textContent = "error"),
      (resultTitle.textContent = "Server unreachable"));
    resultText.textContent =
      "Cannot connect to the server. Is the backend running?";
  }

  verifyBtn.disabled = false;
  verifyBtn.innerHTML =
    '<span class="material-symbols-outlined">verified</span> Verify Document';
});

let selectedFile = null;

dropzone.addEventListener("click", function () {
  fileInput.click();
});

dropzone.addEventListener("dragover", function (event) {
  event.preventDefault();
  dropzone.classList.add("dragover");
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

function setFile(file) {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = (file.size / 1024).toFixed(1) + "KB";
  fileInfo.hidden = false;
  verifyBtn.disabled = false;
  result.hidden = true;
  showPreview(file, previewBox);
}

clearBtn.addEventListener("click", function () {
  selectedFile = null;
  fileInput.value = "";
  fileInfo.hidden = true;
  verifyBtn.disabled = true;
  result.hidden = true;
  clearPreview(previewBox);
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

verifyBtn.addEventListener("click", async function () {
  if (!selectedFile) return;

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Checking...";

  const hash = await hashFile(selectedFile);
  const found = blockchainHashes.includes(hash);

  hashValue.textContent = "0x" + hash;
  result.hidden = false;

  if (found) {
    result.className = "result success";
    resultSymbol.textContent = "check_circle";
    resultTitle.textContent = "Authentic";
    resultText.textContent =
      "This document matches a record stored on the blockchain. It has not been altered.";
  } else {
    result.className = "result fail";
    resultSymbol.textContent = "cancel";
    resultTitle.textContent = "Not found";
    resultText.textContent =
      "No matching record was found. The document may be altered, or it was never issued by the Resistrar's Office.";
  }

  verifyBtn.disabled = false;
  verifyBtn.innerHTML =
    '<span class="material-symbols-outlined">verified</span> Verify Document';
});
