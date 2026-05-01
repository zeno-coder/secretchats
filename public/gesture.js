(function () {
  const COOLDOWN_MS  = 2500;
  const GESTURE_HOLD = 800;

  let gestureEnabled  = false;
  let lastGestureTime = 0;
  let holdTimer       = null;
  let lastPose        = null;
  let handsInstance   = null;
  let cameraInstance  = null;

  function showGestureToast(msg) {
    const el = document.getElementById("gesture-toast");
    if (!el) return;
    el.textContent  = msg;
    el.style.display  = "block";
    el.style.opacity  = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => { el.style.display = "none"; }, 400);
    }, 1800);
  }

  function fireGesture(pose) {
    const now = Date.now();
    if (now - lastGestureTime < COOLDOWN_MS) return;
    lastGestureTime = now;
    const s = window.__gestureSocket;
    if (!s) { console.warn("Gesture: socket not ready"); return; }
    switch (pose) {
      case "palm_flip":
        showGestureToast("☠️chats are clearing");
        s.emit("clear chat");
        break;
      case "thumbs_up":
        showGestureToast("Music ON");
        s.emit("ndn start", { trackIndex: 0, startTime: Date.now() });
        break;
      case "thumbs_down":
        showGestureToast(" Music OFF");
        s.emit("ndn stop");
        break;
      case "fist":
        showGestureToast(" Flowers!");
        s.emit("ndn flowers");
        break;
      case "victory":
        showGestureToast(" Dark mode");
        s.emit("ndn dark");
        break;
      case "stop_hand":
        showGestureToast(" Restoring background");
        s.emit("ndn return");
        break;
      case "point_right":
        showGestureToast(" Next track");
        s.emit("ndn next", { startTime: Date.now() });
        break;
      case "point_left":
        showGestureToast(" Previous track");
        s.emit("ndn prev", { startTime: Date.now() });
        break;
      case "call_me":
        showGestureToast(" Random track");
        const randomTrack = Math.floor(Math.random() * 60);
        s.emit("ndn start", { trackIndex: randomTrack, startTime: Date.now() });
        break;
    }
  }

function tipY(lm, finger) {
    const tips = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
    return lm[tips[finger]].y;
  }
  function tipX(lm, finger) {
    const tips = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
    return lm[tips[finger]].x;
  }
  function pipY(lm, finger) {
    const pips = { index: 6, middle: 10, ring: 14, pinky: 18 };
    return lm[pips[finger]].y;
  }
  function mcpY(lm, finger) {
    const mcps = { index: 5, middle: 9, ring: 13, pinky: 17 };
    return lm[mcps[finger]].y;
  }
  function extended(lm, finger) {
    return tipY(lm, finger) < pipY(lm, finger) - 0.04 &&
           tipY(lm, finger) < mcpY(lm, finger) - 0.06;
  }
  function curled(lm, finger) {
    return tipY(lm, finger) > pipY(lm, finger) - 0.01;
  }
  function thumbUp(lm) {
      // thumb tip well above the index MCP and wrist
      return lm[4].y < lm[5].y - 0.04 && lm[4].y < lm[0].y - 0.05;
    }
  function thumbDown(lm) {
    // thumb tip well below the wrist
    return lm[4].y > lm[0].y + 0.02;
  }
  function thumbExtended(lm) {
    return Math.abs(lm[4].x - lm[3].x) > 0.06;
  }
  function handFacingUp(lm) {
    return lm[0].y > lm[9].y + 0.05;
  }
  function allFingersCurled(lm) {
    return curled(lm, "index") && curled(lm, "middle") &&
           curled(lm, "ring")  && curled(lm, "pinky");
  }
 function classifyPose(lm) {
    const idx  = extended(lm, "index");
    const mid  = extended(lm, "middle");
    const ring = extended(lm, "ring");
    const pink = extended(lm, "pinky");
    const thb  = thumbExtended(lm);
    const up   = handFacingUp(lm);
    const allCurled = allFingersCurled(lm);

    // call_me MUST come before point_left since both use pinky
    if (!idx && !mid && !ring && pink && thb)  return "call_me";

    // thumbs up/down — check before fist since fist also has allCurled
    if (allCurled && thumbUp(lm))              return "thumbs_up";
    if (allCurled && thumbDown(lm))            return "thumbs_down";

    // fist — all curled, thumb also tucked
    if (allCurled && !thb)                     return "fist";

    // open palm
    if (idx && mid && ring && pink && up)      return "palm_flip";
    if (idx && mid && ring && pink && !up)     return "stop_hand";

    // victory
    if (idx && mid && !ring && !pink)          return "victory";

    // single finger points
    if (idx && !mid && !ring && !pink)         return "point_right";
    if (!idx && !mid && !ring && pink && !thb) return "point_left";

    return null;
  }

  function onPose(pose) {
    if (!pose) {
      clearTimeout(holdTimer);
      holdTimer = null;
      lastPose  = null;
      return;
    }
    if (pose !== lastPose) {
      clearTimeout(holdTimer);
      lastPose  = pose;
      holdTimer = setTimeout(() => fireGesture(pose), GESTURE_HOLD);
    }
  }

  function startGestureCamera() {
    if (gestureEnabled) return;

    // ── admin check ──────────────────────────────────────────────────────
    const adminUsers = ["Thejus", "Nandhana", "Anjana"];
    const isAdminNow = adminUsers.includes(localStorage.getItem("username"))
                    || window.__isDevAdmin;
    if (!isAdminNow) { showGestureToast("❌ Admin only"); return; }

    gestureEnabled         = true;
    window.__gestureActive = true;
    showGestureToast("📷 Starting camera…");

    const videoEl = document.getElementById("gesture-video");

    // ── MediaPipe Hands setup ────────────────────────────────────────────
    handsInstance = new Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    handsInstance.setOptions({
      maxNumHands:            1,
      modelComplexity:        0,
      minDetectionConfidence: 0.75,
      minTrackingConfidence:  0.75
    });

    handsInstance.onResults((results) => {
      if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
        onPose(null);
        return;
      }
      onPose(classifyPose(results.multiHandLandmarks[0]));
    });

    // ── Camera ───────────────────────────────────────────────────────────
    cameraInstance = new Camera(videoEl, {
      onFrame: async () => { await handsInstance.send({ image: videoEl }); },
      width: 320, height: 240
    });
    cameraInstance.start().then(() => {
      showGestureToast("✅ Camera ready — show a gesture!");
    }).catch((err) => {
      showGestureToast("❌ Camera error: " + err.message);
      gestureEnabled         = false;
      window.__gestureActive = false;
    });
  }

  function stopGestureCamera() {
    gestureEnabled         = false;
    window.__gestureActive = false;
    if (cameraInstance) { try { cameraInstance.stop(); } catch(e) {} cameraInstance = null; }
    if (handsInstance)  { try { handsInstance.close(); } catch(e) {} handsInstance  = null; }
    showGestureToast("📷 Gesture control OFF");
    // small delay then reload to fully release camera
    setTimeout(() => location.reload(), 1200);
  }

  window.gestureOn  = startGestureCamera;
  window.gestureOff = stopGestureCamera;

  // ── Inject menu row ───────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    const divider = document.querySelector(".menu-divider");
    if (!divider) return;

    const row = document.createElement("div");
    row.className = "menu-row";
    row.id        = "gesture-menu-btn";
    row.innerHTML = `
      <div class="menu-icon-chip chip-purple">🖐</div>
      <span class="menu-label">Gestures</span>
      <div class="pill-toggle" id="gesture-pill"><div class="pill-knob"></div></div>
    `;
    divider.parentNode.insertBefore(row, divider);

    const pill = document.getElementById("gesture-pill");
    row.addEventListener("click", () => {
      const adminUsers = ["Thejus", "Nandhana", "Anjana"];
      const isAdminNow = adminUsers.includes(localStorage.getItem("username"))
                      || window.__isDevAdmin;
      if (!isAdminNow) { showGestureToast("❌ Admin only"); return; }

      if (!gestureEnabled) {
        pill.classList.add("on");
        startGestureCamera();
      } else {
        pill.classList.remove("on");
        stopGestureCamera();
      }
    });
  });
})();