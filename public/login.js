document.addEventListener("DOMContentLoaded", () => {
  bootAuthEngine();
  const bgMusic = document.getElementById("bg-music");
  if (bgMusic) MusicController.init(bgMusic);
  const firstInput = document.getElementById("username");
  if (firstInput) {
    firstInput.addEventListener("focus", () => {
      MusicController.start(0.22);
    }, { once: true });
  }
  const form     = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  if (!form) return;

  loginBtn.addEventListener("click", (e) => {
    AuthUI.addRipple(loginBtn, e);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    if (!username || !password) {
      AuthUI.showError("Please fill in all fields.");
      return;
    }
    AuthUI.setLoading(loginBtn, true);
    try {
      const res = await fetch("/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const msg = await res.text();
        AuthUI.setLoading(loginBtn, false);
        AuthUI.showError(msg || "Login failed. Try again.");
        return;
      }
      const data = await res.json();
      localStorage.setItem("token",    data.token);
      localStorage.setItem("user_id",  data.user_id);
      localStorage.setItem("username", data.username);
      localStorage.setItem("room_id",  data.room_id);
      AuthUI.setLoading(loginBtn, false);
      AuthUI.successTransition("/index.html");
    } catch (err) {
      AuthUI.setLoading(loginBtn, false);
      AuthUI.showError(err.message || "Network error. Please try again.");
    }
  });

});
