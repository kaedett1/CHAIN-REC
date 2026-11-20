const card = document.getElementById("loginCard");
const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const toggleBtn = document.getElementById("togglePassword");
const errorMessage = document.getElementById("errorMessage");
const loginBtn = document.getElementById("loginBtn");

toggleBtn.addEventListener("click", function () {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleBtn.textContent = "Hide";
  } else {
    passwordInput.type = "password";
    toggleBtn.textContent = "Show";
  }
});

function showError(message) {
  errorMessage.textContent = message;
  card.classList.remove("shake");
  void card.offsetWidth;
  card.classList.add("shake");
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const role = document.querySelector('input[name="role"]:checked').value;
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (email === "" || !email.includes("@")) {
    showError("Please enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  errorMessage.textContent = "";
  loginBtn.textContent = "Signing in...";
  loginBtn.disabled = true;

  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message);
      loginBtn.textContent = "Sign In";
      loginBtn.disabled = false;
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("firstName", data.firstName);
    localStorage.setItem("userEmail", data.email);
    localStorage.setItem("userRole", data.role);

    window.location.href = "./dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    showError("Error: " + error.message);
    loginBtn.textContent = "Sign In";
    loginBtn.disabled = false;
  }
});
