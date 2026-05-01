document.addEventListener("DOMContentLoaded", () => {
  bootAuthEngine();
  const form      = document.getElementById("signup-form");
  const signupBtn = document.getElementById("signup-btn");
  if (!form) return;
  signupBtn.addEventListener("click", (e) => {
    AuthUI.addRipple(signupBtn, e);
  });
  document.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("focus", () => {
      const rect = inp.getBoundingClientRect();
      ParticleEngine.burst(rect.left + rect.width / 2, rect.top, 6);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username      = document.getElementById("username").value.trim();
    const password      = document.getElementById("password").value;
    const roomCodeInput = document.getElementById("room-code");
    const room_code     = roomCodeInput?.value.trim();
    if (!username || !password) {
      AuthUI.showError("Please fill in your username and password.");
      return;
    }

    if (username.length < 2) {
      AuthUI.showError("Username must be at least 2 characters.");
      return;
    }

    const payload = { username, password };
    if (room_code) payload.room_code = room_code;
    AuthUI.setLoading(signupBtn, true);

    try {
      const res = await fetch("/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });

      if (!res.ok) {
        const msg = await res.text();
        AuthUI.setLoading(signupBtn, false);
        AuthUI.showError(msg || "Signup failed. Try again.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token",    data.token);
      localStorage.setItem("user_id",  data.user_id);
      localStorage.setItem("username", data.username);
      localStorage.setItem("room_id",  data.room_id);
      AuthUI.setLoading(signupBtn, false);
      AuthUI.successTransition("/index.html");

    } catch (err) {
      AuthUI.setLoading(signupBtn, false);
      AuthUI.showError(err.message || "Network error. Please try again.");
    }
  });

});
