document.addEventListener("DOMContentLoaded", () => {
  const token    = localStorage.getItem("token");
  const userId   = localStorage.getItem("user_id");
  const username = localStorage.getItem("username");
  if (!token || !userId || !username) {window.location.href = "/login.html";return;}
  const socket = io("/", { auth: { token } });
  socket.on("connect", () => console.log("✅ Socket connected", socket.id));
  socket.on("connect_error", err => {
    console.error("❌ Socket auth error:", err.message);
    if (err.message === "Invalid token") {
      localStorage.clear();
      window.location.href = "/login.html";
    }
  });
  window.__gestureSocket   = socket;
  window.__isDevAdmin      = false;
  window.__gestureUsername = username;

  const form               = document.getElementById("form");
  const input              = document.getElementById("input");
  const messages           = document.getElementById("messages");
  const recordBtn          = document.getElementById("record-btn");
  const typingIndicator    = document.getElementById("typing-indicator");
  const imageInput         = document.getElementById("image-input");
  const imageBtn           = document.getElementById("image-btn");
  const replyBar           = document.getElementById("reply-bar");
  const repliedMessageText = document.getElementById("replied-message-text");
  const cancelReplyBtn     = document.getElementById("cancel-reply");
  const musicToggleLabel   = document.getElementById("toggle-music-label");
  const musicToggle        = document.getElementById("toggle-music");
  const musicController    = document.getElementById("music-controller");
  const trackNameSpan      = document.getElementById("track-name");
  const playPauseBtn       = document.getElementById("play-pause");
  const nextBtn            = document.getElementById("next-track");
  const prevBtn            = document.getElementById("prev-track");
  const partnerAvatar      = document.getElementById("partner-avatar-initial");
  const partnerNameDisplay = document.getElementById("partner-name-display");
  const partnerStatusText  = document.getElementById("partner-status-text");
  const onlineDot          = document.getElementById("online-dot");
  const roomCodeBtn        = document.getElementById("room-code-btn");
  const roomCodeText       = document.getElementById("room-code-text");
  const wallpaperInput     = document.getElementById("wallpaper-input");
  const menuWallpaperBtn   = document.getElementById("menu-wallpaper-btn");
  let messageCounter    = 0;
  let repliedMessage    = null;
  let musicEnabled      = false;
  let currentTrackIndex = 0;
  let currentAudio      = null;
  let mediaStream       = null;
  let mediaRecorder     = null;
  let audioChunks       = [];
  let flowerInterval    = null;
  let usersTyping       = new Set();
  let recordingUsers    = new Set();
  let activeUsers       = new Set();
  let typingTimeout     = null;
  let isTyping          = false;
  let isRecording       = false;
  let canceled          = false;
  let isHold            = false;
  let holdTimeout       = null;
  let startX            = 0;
  let previousUsers     = [];
  let partnerName       = null;
  let roomCode          = null;
  let isAdmin           = false;
  let commandCooldown   = false;

  if (menuWallpaperBtn && wallpaperInput) {
    menuWallpaperBtn.addEventListener("click", () => { wallpaperInput.click(); });
  }

  const ADMIN_USERS = ["Thejus", "Nandhana", "Anjana"];
  function isAdminUser() { return ADMIN_USERS.includes(username) || isAdmin; }
  const REACTIONS = ["❤️", "😂", "🥺", "🔥", "👏", "😍"];

  const musicUrls = [
    "https://files.catbox.moe/mi9igu.mp4",
    "https://files.catbox.moe/a4jv43.mp4",
    "https://files.catbox.moe/x4wwty.mp4",
    "https://files.catbox.moe/dr6g3i.mp4",
    "https://files.catbox.moe/hic3ht.mp4",
    "https://files.catbox.moe/t8e1x9.mp4",
    "https://files.catbox.moe/rmf1cg.mp4",
    "https://files.catbox.moe/ioeftv.mp4",
    "https://files.catbox.moe/ri548a.mp4",
    "https://files.catbox.moe/jl8hvn.mp4",
    "https://files.catbox.moe/ceyeyl.mp4",
    "https://files.catbox.moe/6rm8vd.mp4",
    "https://files.catbox.moe/bcrbr6.mp4",
    "https://files.catbox.moe/paqtae.mp4",
    "https://files.catbox.moe/mx0pha.mp4",
    "https://files.catbox.moe/ip9a6m.mp4",
    "https://files.catbox.moe/uj0338.mp4",
    "https://files.catbox.moe/kofc8i.mp4",
    "https://files.catbox.moe/ggx6bs.mp3",
    "https://files.catbox.moe/jf1jjs.mp4",
    "https://files.catbox.moe/i5i7a2.mp4",
    "https://files.catbox.moe/ljzval.mp4",
    "https://files.catbox.moe/5qox9n.mp4",
    "https://files.catbox.moe/hi2whc.mp4",
    "https://files.catbox.moe/h5hevr.mp4",
    "https://files.catbox.moe/qevape.mp4",
    "https://files.catbox.moe/s4us9i.mp3",
    "https://files.catbox.moe/76g7qu.mp4",
    "https://files.catbox.moe/zb08d5.mp4",
    "https://files.catbox.moe/gzdd9f.mp3",
    "https://files.catbox.moe/ni30vo.mp4",
    "https://files.catbox.moe/zqmlpu.mp4",
    "https://files.catbox.moe/t12usb.mp4",
    "https://files.catbox.moe/9olfxv.mp4",
    "https://files.catbox.moe/i541iw.mp4",
    "https://files.catbox.moe/zfgl60.mp4",
    "https://files.catbox.moe/b6fybu.mp4",
    "https://files.catbox.moe/js05nr.mp4",
    "https://files.catbox.moe/5504r6.mp3",
    "https://files.catbox.moe/9pw1ym.mp4",
    "https://files.catbox.moe/9nv0nw.mp3",
    "https://files.catbox.moe/exa8zj.mp3",
    "https://files.catbox.moe/nxyai1.mp4",
    "https://files.catbox.moe/1uw2z5.mpeg",
    "https://files.catbox.moe/basj61.mp4",
    "https://files.catbox.moe/7f0pzh.mp4",
    "https://files.catbox.moe/bwzfe7.mp4",
    "https://files.catbox.moe/0zhxlu.mp4",
    "https://files.catbox.moe/st9i8s.mp4",
    "https://files.catbox.moe/t7yvae.mp4",
    "https://files.catbox.moe/l539l7.mp4",
    "https://files.catbox.moe/xjqxn7.mp4",
    "https://files.catbox.moe/ku2vhg.mp4",
    "https://files.catbox.moe/sf6yg5.mp4",
    "https://files.catbox.moe/utdobw.mp4",
    "https://files.catbox.moe/x0t9pc.mp4",
    "https://files.catbox.moe/prw3g6.mp4",
    "https://files.catbox.moe/j2ncnz.mp4",
    "https://files.catbox.moe/o1gvpb.mp4",
    "https://files.catbox.moe/74pf42.mp4"
  ];

  const commands = {
    cls:      (args) => handleClearChat(args),
    dlt:      (args) => handleDeleteMessage(args),
    ndn:      (args) => handleNDNCommand(args),
    promote:  (args) => handlePromote(args),
    demote:   (args) => handleDemote(args),
    returnbg: (args) => handleReturnBg(args),
    help:     (args) => handleHelp(args),
    nana:     (args) => handleNana(args),
    devadmin: (args) => handleDevAdmin(args)
  };

  function handleInput(text) {
    const trimmed = text.trim();
    const raw     = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    const parts   = raw.split(/\s+/);
    const cmd     = parts[0].toLowerCase();
    const args    = parts.slice(1);
    if (commands[cmd]) {
      if (commandCooldown) { showToast(" Onnn adangeda mowne🎈"); return true; }
      commandCooldown = true;
      setTimeout(() => { commandCooldown = false; }, 600);
      commands[cmd](args);
      return true;
    }
    return false;
  }

  function handleClearChat() {
    if (!isAdminUser()) { showToast("❌ Admin only command"); return; }
    socket.emit("clear chat");
  }

  function handleDeleteMessage() {
    if (!repliedMessage || !repliedMessage.id) { showToast("↩️ Reply to a message first, then type dlt"); return; }
    socket.emit("delete message", {
      targetUser:  repliedMessage.user,
      targetText:  repliedMessage.text,
      targetId:    repliedMessage.id,
      commandUser: username,
      commandText: "dlt"
    });
    clearReply();
  }

  function handleNDNCommand(args) {
    if (!isAdminUser()) { showToast("❌ Admin only command"); return; }
    const action = (args[0] || "").toLowerCase();
    switch (action) {
      case "start":
        socket.emit("ndn start", { trackIndex: currentTrackIndex, startTime: Date.now() });
        break;
      case "stop":
        socket.emit("ndn stop");
        break;
      case "play": {
        const idx = parseInt(args[1], 10);
        if (isNaN(idx) || idx < 1 || idx > musicUrls.length) {
          showToast(`🎵 Track must be 1–${musicUrls.length}`);
          return;
        }
        socket.emit("ndn start", { trackIndex: idx - 1, startTime: Date.now() });
        break;
      }
      case "next":
        socket.emit("ndn next", { startTime: Date.now() });
        break;
      case "prev":
        socket.emit("ndn prev", { startTime: Date.now() });
        break;
      case "jump":
        socket.emit("ndn jump", { trackIndex: currentTrackIndex, startTime: Date.now() });
        break;
      case "dark":
        socket.emit("ndn dark");
        break;
      case "return":
        socket.emit("ndn return");
        break;
      case "wall":
        wallpaperInput.click();
        break;
      case "flowers":
        socket.emit("ndn flowers");
        break;
      case "list":
        socket.emit("ndn list");
        break;
      case "kick": {
        const targetId = parseInt(args[1], 10);
        if (isNaN(targetId)) { showToast("❌ Usage: ndn kick <user_id>"); return; }
        socket.emit("ndn kick", targetId);
        break;
      }
      case "nuke": {
        const targetId = parseInt(args[1], 10);
        if (isNaN(targetId)) { showToast("❌ Usage: ndn nuke <user_id>"); return; }
        if (!confirm(`☠️ NUKE user ${targetId}? This deletes their room & messages permanently!`)) return;
        socket.emit("ndn nuke", targetId);
        break;
      }
      case "add": {
        const newUser  = args[1];
        const password = args[2];
        const room_code = args[3] || null;
        if (!newUser || !password) { showToast("❌ Usage: ndn add <username> <password> [room_code]"); return; }
        socket.emit("ndn add", { username: newUser, password, room_code });
        break;
      }
        case "gest":
        if (!isAdminUser()) { showToast("❌ Admin only command"); return; }
        if (typeof window.gestureOn === "function") {
          if (!window.__gestureActive) {
            window.__gestureActive = true;
            window.gestureOn();
            showToast("🖐 Gesture control ON");
          } else {
            window.__gestureActive = false;
            window.gestureOff();
            showToast("📷 Gesture control OFF");
          }
        } else {
          showToast("❌ Gesture module not loaded");
        }
        break;
      default: {
        const trackNum = parseInt(action, 10);
        if (!isNaN(trackNum) && trackNum >= 1 && trackNum <= musicUrls.length) {
          socket.emit("ndn start", { trackIndex: trackNum - 1, startTime: Date.now() });
        } else {
          showToast("🎵 ndn: start|stop|play <n>|next|prev|jump|dark|return|wall|flowers|list|kick <id>|nuke <id>|add <user> <pass> [code]");
        }
        break;
      }
    }
  }            

  socket.on("ndn list result", (users) => {
    console.table(users);
    showToast(`👥 ${users.length} users — check console`);
  });

  socket.on("ndn kicked", (targetId) => {
    showToast(`👻 User ${targetId} was kicked`);
  });

  socket.on("ndn nuked", (data) => {
    showToast(`☠️ Room ${data.roomId} nuked`);
  });

  socket.on("ndn add result", (data) => {
    showToast(`✅ Added ${data.username} (id: ${data.user_id})`);
    console.log("ndn add result:", data);
  });
  function handlePromote() {
    if (!isAdminUser()) { showToast("❌ Admin only"); return; }
    socket.emit("admin command", { action: "promote", by: username });
  }

  function handleDemote() {
    if (!isAdminUser()) { showToast("❌ Admin only"); return; }
    socket.emit("admin command", { action: "demote", by: username });
  }

  function handleReturnBg() {
    socket.emit("return bg");
  }

  function handleHelp() {
    showToast("Commands loaded — see console");
    console.log([
      "── CHATAPP COMMANDS ──",
      "cls                          — clear chat (admin)",
      "dlt                          — delete replied message",
      "ndn start/stop               — music on/off",
      "ndn play <n>                 — play track n",
      "ndn next / prev / jump       — music navigation",
      "ndn dark / return            — dark overlay toggle",
      "ndn wall                     — set wallpaper (local picker)",
      "ndn flowers                  — flower rain",
      "ndn list                     — list all users (admin, see console)",
      "ndn kick <user_id>           — kick a user (admin)",
      "ndn nuke <user_id>           — destroy user's room (admin)",
      "ndn add <user> <pass> [code] — create user (admin)",
      "returnbg                     — reset background",
      "promote / demote             — admin control",
      "nana <message>               — chat with Nana 💕"
    ].join("\n"));
  }
    function handleDevAdmin(args) {
  const devKey = args[0];
  if (!devKey) { showToast("❌ Usage: devadmin <key>"); return; }

  const token = localStorage.getItem("token");
  fetch("/dev-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: devKey, token })
  })
  .then(r => r.json())
  .then(data => {
    if (data.devToken) {
      localStorage.setItem("token", data.devToken);
      isAdmin = true;
      window.__isDevAdmin = true;
      socket.auth.token = data.devToken;
      socket.disconnect();
      socket.connect();
      showToast("☠️ Dev admin granted!");
    } else {
      showToast("❌ Wrong key");
    }
  })
  .catch(() => showToast("❌ Server error"));
}

  async function handleNana(args) {
    const text = args.join(" ");
    if (!text) { showToast("💬 Ask Nana something"); return; }

    function typeMessage(text, element, callback) {
      let i = 0, current = "";
      const interval = setInterval(() => {
        current += text[i]; i++;
        element.textContent = current;
        if (i >= text.length) { clearInterval(interval); if (callback) callback(); }
      }, 20 + Math.random() * 30);
    }

    try {
      const res = await fetch("/api/nana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, username })
      });
      const data = await res.json();
      const tempMsg = appendMessage({ user: "Nana 💕", text: "", id: Date.now().toString() }, "received");
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
      typeMessage(data.reply, tempMsg);
    } catch (err) {
      showToast("❌ Nana failed");
    }
  }

  function createFlower() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("flower-wrapper");
    const flower = document.createElement("div");
    flower.classList.add("flower");
    flower.textContent = ["🌸","🌺","🌹","💐","🌼"][Math.floor(Math.random() * 5)];
    wrapper.style.left = Math.random() * 100 + "vw";
    const fd = 4 + Math.random() * 3;
    wrapper.style.animationDuration = fd + "s";
    flower.style.animationDuration  = `${2 + Math.random() * 2}s, ${3 + Math.random() * 4}s`;
    wrapper.appendChild(flower);
    document.body.appendChild(wrapper);
    setTimeout(() => wrapper.remove(), (fd + 1) * 1000);
  }

  function startFlowerEffect() {
    if (flowerInterval) return;
    flowerInterval = setInterval(createFlower, 500);
    const toggle = document.getElementById("toggle-flowers");
    if (toggle) toggle.checked = true;
    const pill = document.getElementById("toggle-flowers-pill");
    if (pill) pill.classList.add("on");
  }

  function stopFlowerEffect() {
    clearInterval(flowerInterval);
    flowerInterval = null;
    document.querySelectorAll(".flower-wrapper").forEach(f => f.remove());
    const toggle = document.getElementById("toggle-flowers");
    if (toggle) toggle.checked = false;
    const pill = document.getElementById("toggle-flowers-pill");
    if (pill) pill.classList.remove("on");
  }
  socket.on("ndn start", (data) => {
    musicEnabled = true;
    if (musicController) musicController.style.display = "flex";
    if (musicToggleLabel) musicToggleLabel.style.display = "flex";
    syncPlay(data.trackIndex, data.startTime);
  });

  socket.on("ndn stop", () => {
    if (currentAudio) currentAudio.pause();
    musicEnabled = false;
    if (musicController) musicController.style.display = "none";
  });

  socket.on("ndn next", (data) => {
    syncPlay((currentTrackIndex + 1) % musicUrls.length, data.startTime);
  });

  socket.on("ndn prev", (data) => {
    syncPlay((currentTrackIndex - 1 + musicUrls.length) % musicUrls.length, data.startTime);
  });

  socket.on("ndn jump", (data) => {
    syncPlay(data.trackIndex, data.startTime);
  });

  socket.on("ndn dark", () => {
    document.documentElement.style.setProperty("--bg-base", "#000");
    document.body.style.filter = "brightness(0.6)";
    showToast("🌑 Dark mode on");
  });

  socket.on("ndn return", () => {
    document.documentElement.style.removeProperty("--bg-base");
    document.body.style.filter = "";
    showToast("☀️ Dark mode off");
  });

  socket.on("ndn flowers", () => {
    startFlowerEffect();
    showToast("🌸 Flower mode activated");
  });

  socket.on("admin command", (data) => {
if (data.action === "promote")      { isAdmin = true;  window.__isDevAdmin = true;  showToast("👑 You've been promoted to admin"); }
    else if (data.action === "demote")  { isAdmin = false; window.__isDevAdmin = false; showToast("🔻 Admin access removed"); }
  });

  socket.on("return bg", () => {
    wallpaperActive = false;
    const wallLayer = document.getElementById("wallpaper-layer");
    if (wallLayer) wallLayer.remove();
    if (bgLayerA && bgLayerB) {
      bgLayerA.style.opacity = "1";
      bgLayerB.style.opacity = "0";
      bgLayerA.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
      bgFront = "A";
    }
    showToast("✨ Background restored");
  });

  socket.on("clear chat", () => {
    const allItems = document.querySelectorAll("#messages .msg-row, #messages li");
    allItems.forEach(el => {
      el.style.transition = "opacity 0.4s, transform 0.4s";
      el.style.opacity    = "0";
      el.style.transform  = "scale(0.8)";
    });
    setTimeout(() => { messages.innerHTML = ""; }, 420);
  });

  socket.on("set wallpaper", (data) => {
    applyWallpaper(data.wallpaper);
  });
  function syncPlay(trackIndex, startTime) {
    if (currentAudio) currentAudio.pause();
    currentTrackIndex = ((trackIndex % musicUrls.length) + musicUrls.length) % musicUrls.length;
    currentAudio = new Audio(musicUrls[currentTrackIndex]);
    currentAudio.volume = 0.25;
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    currentAudio.currentTime = Math.max(0, elapsed);
    currentAudio.play().catch(() => {
      showToast("🎵 Tap anywhere to start synced music");
      document.addEventListener("click", () => currentAudio.play().catch(() => {}), { once: true });
    });
    if (trackNameSpan) trackNameSpan.textContent = `Track ${currentTrackIndex + 1}`;
    if (musicController) musicController.style.display = "flex";
    currentAudio.onended = () => syncPlay(currentTrackIndex + 1, Date.now());
  }

  function playTrack(index) {
    if (currentAudio) currentAudio.pause();
    currentTrackIndex = ((index % musicUrls.length) + musicUrls.length) % musicUrls.length;
    currentAudio = new Audio(musicUrls[currentTrackIndex]);
    currentAudio.volume = 0.25;
    currentAudio.play().catch(() => {});
    if (trackNameSpan) trackNameSpan.textContent = `Track ${currentTrackIndex + 1}`;
    currentAudio.onended = () => playTrack(currentTrackIndex + 1);
  }

  function startMusic() {
    musicEnabled = true;
    if (musicController) musicController.style.display = "flex";
    playTrack(currentTrackIndex);
  }

  function stopMusic() {
    musicEnabled = false;
    if (currentAudio) currentAudio.pause();
    if (musicController) musicController.style.display = "none";
  }

  if (typeof RENDER_MUSIC_ENABLED !== "undefined" && RENDER_MUSIC_ENABLED === "true") {
    if (musicToggleLabel) musicToggleLabel.style.display = "flex";
    if (musicToggle) musicToggle.addEventListener("change", () => {
      musicToggle.checked ? startMusic() : stopMusic();
    });
  }

  if (playPauseBtn) playPauseBtn.addEventListener("click", () => {
    if (!currentAudio) { playTrack(currentTrackIndex); return; }
    currentAudio.paused ? currentAudio.play() : currentAudio.pause();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => playTrack(currentTrackIndex + 1));
  if (prevBtn) prevBtn.addEventListener("click", () => playTrack(currentTrackIndex - 1));
  function updateTopbarPartner(userList) {
    const others = userList.filter(u => u !== username);
    const partner = others[0];
    if (!partner) {
      partnerNameDisplay.textContent       = "Waiting…";
      partnerStatusText.textContent        = "Not online yet";
      partnerStatusText.style.color        = "rgba(245,238,255,0.35)";
      if (onlineDot) onlineDot.style.display = "none";
    } else {
      partnerName = partner;
      partnerNameDisplay.textContent       = partner + " 💕";
      partnerStatusText.textContent        = "Online now";
      partnerStatusText.style.color        = "#4ade80";
      partnerAvatar.textContent            = partner.charAt(0).toUpperCase();
      if (onlineDot) onlineDot.style.display = "block";
    }
  }

  function updatePCActiveUsersList() {
    const usersList = document.getElementById("users-list");
    if (!usersList) return;
    usersList.innerHTML = "";
    activeUsers.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u;
      if (u === username) li.classList.add("me");
      usersList.appendChild(li);
    });
  }
  socket.on("update users", (userList) => {
    updateTopbarPartner(userList);
    activeUsers = new Set(userList);
    if (window.innerWidth >= 600) {
      updatePCActiveUsersList();
    } else {
      const joined = userList.filter(u => !previousUsers.includes(u) && u !== username);
      const left   = previousUsers.filter(u => !userList.includes(u) && u !== username);
      joined.forEach(u => showMobileNotification(u, "joined 💕"));
      left.forEach(u   => showMobileNotification(u, "left"));
    }

    previousUsers = [...userList];
    refreshRoomCode();
  });

  socket.on("joined_room", (data) => {
    if (!data.messages) return;
    messages.innerHTML = "";
    lastMessageDate = null; // reset date tracker on room join
    data.messages.forEach(msg => {
      const isOwn = String(msg.sender_id) === String(userId);
      insertDateSeparatorIfNeeded(msg.timestamp);
      appendMessage({
        user: isOwn ? username : msg.sender_username,
        text: msg.message_content,
        id:   String(msg.message_id),
        ts:   msg.timestamp
      }, isOwn ? "sent" : "received", false);
    });
    messages.scrollTop = messages.scrollHeight;
  });
function formatTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateLabel(ts) {
    const d   = ts ? new Date(ts) : new Date();
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString())       return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
  }

  let lastMessageDate = null;

  function insertDateSeparatorIfNeeded(ts) {
    const d = ts ? new Date(ts) : new Date();
    const dateStr = d.toDateString();
    if (dateStr === lastMessageDate) return;
    lastMessageDate = dateStr;
    const sep = document.createElement("div");
    sep.classList.add("day-separator");
    sep.textContent = formatDateLabel(ts);
    messages.appendChild(sep);
  }

  function appendMessage(msgObj, type, animate = true) {
    if (animate) insertDateSeparatorIfNeeded(msgObj.ts);
    const isSent = type === "sent";
    const row = document.createElement("div");
    row.classList.add("msg-row", type);
    if (!isSent) {
      const av = document.createElement("div");
      av.classList.add("msg-mini-avatar");
      av.textContent = (msgObj.user || "?").charAt(0).toUpperCase();
      row.appendChild(av);
    }

    const wrap = document.createElement("div");
    wrap.classList.add("msg-bubble-wrap");
    const li = document.createElement("li");
    li.classList.add(type);
    li.dataset.user = msgObj.user || "";
    li.dataset.text = msgObj.text || "";
    li.dataset.id   = msgObj.id   || (messageCounter++).toString();
    if (msgObj.replied) {
      let prev = String(msgObj.replied.text || "").trim();
      if (prev.length > 100) prev = prev.slice(0, 97) + "…";
      const rp = document.createElement("div");
      rp.classList.add("replied-preview");
      rp.innerHTML = `<strong>${escapeHtml(msgObj.replied.user)}:</strong> ${escapeHtml(prev)}`;
      li.appendChild(rp);
    }

    li.appendChild(document.createTextNode(msgObj.text || ""));
    const glowToggle = document.getElementById("toggle-glow");
    if (animate && glowToggle && glowToggle.checked) {
      li.classList.add("glow");
      li.addEventListener("animationend", () => li.classList.remove("glow"), { once: true });
    }

    const heartToggle = document.getElementById("toggle-heart");
    if (animate && heartToggle && heartToggle.checked) {
      const heart = document.createElement("div");
      heart.classList.add("heart-ripple");
      li.appendChild(heart);
      setTimeout(() => heart.remove(), 700);
    }

    wrap.appendChild(li);
    const meta = document.createElement("div");
    meta.classList.add("msg-meta");
    meta.innerHTML = `<span>${formatTime(msgObj.ts)}</span>${isSent ? '<span class="read-ticks">✓✓</span>' : ""}`;
    wrap.appendChild(meta);
    const reactionBar = document.createElement("div");
    reactionBar.classList.add("reaction-bar");
    reactionBar.dataset.msgId = li.dataset.id;
    wrap.appendChild(reactionBar);
    row.appendChild(wrap);
    messages.appendChild(row);
    let lastTap = 0;
    li.addEventListener("click", () => {
      const now = Date.now();
      if (now - lastTap < 350) showReactionPicker(li, reactionBar, msgObj.id || li.dataset.id);
      lastTap = now;
    });

    messages.scrollTop = messages.scrollHeight;
    return li;
  }

  function showReactionPicker(bubble, reactionBar, msgId) {
    document.querySelectorAll(".reaction-picker").forEach(p => p.remove());
    const picker = document.createElement("div");
    picker.classList.add("reaction-picker");
    Object.assign(picker.style, {
      position: "absolute", zIndex: "200",
      background: "rgba(14,8,22,0.92)",
      border: "0.5px solid rgba(255,255,255,0.12)",
      borderRadius: "24px", padding: "6px 8px",
      display: "flex", gap: "6px",
      boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
      backdropFilter: "blur(20px)",
      animation: "msgSlideIn 0.2s ease both"
    });
    REACTIONS.forEach(emoji => {
      const btn = document.createElement("span");
      btn.textContent = emoji;
      Object.assign(btn.style, { fontSize: "20px", cursor: "pointer", transition: "transform 0.15s", userSelect: "none" });
      btn.addEventListener("mouseenter", () => btn.style.transform = "scale(1.3)");
      btn.addEventListener("mouseleave", () => btn.style.transform = "scale(1)");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addReaction(reactionBar, emoji);
        socket.emit("react message", { msgId, emoji, user: username });
        picker.remove();
      });
      picker.appendChild(btn);
    });
    const bubbleRect = bubble.getBoundingClientRect();
    const chatRect   = document.querySelector(".chat-container").getBoundingClientRect();
    picker.style.left     = Math.max(0, bubbleRect.left - chatRect.left) + "px";
    picker.style.top      = (bubbleRect.top - chatRect.top - 48) + "px";
    picker.style.position = "absolute";
    document.querySelector(".chat-body").style.position = "relative";
    document.querySelector(".chat-body").appendChild(picker);
    setTimeout(() => document.addEventListener("click", () => picker.remove(), { once: true }), 10);
  }

  function addReaction(reactionBar, emoji) {
    const existing = [...reactionBar.querySelectorAll(".reaction-chip")].find(c => c.dataset.emoji === emoji);
    if (existing) {
      const count = parseInt(existing.dataset.count || "1") + 1;
      existing.dataset.count = count;
      existing.textContent = `${emoji} ${count}`;
    } else {
      const chip = document.createElement("div");
      chip.classList.add("reaction-chip");
      chip.dataset.emoji = emoji;
      chip.dataset.count = "1";
      chip.textContent = emoji;
      reactionBar.appendChild(chip);
    }
  }

  socket.on("react message", ({ msgId, emoji }) => {
    document.querySelectorAll(".msg-bubble-wrap").forEach(wrap => {
      const li  = wrap.querySelector("li");
      const bar = wrap.querySelector(".reaction-bar");
      if (li && bar && (li.dataset.id === String(msgId) || bar.dataset.msgId === String(msgId))) {
        addReaction(bar, emoji);
      }
    });
  });
  function appendImageMessage(data, isSent) {
    const type = isSent ? "sent" : "received";
    const row  = document.createElement("div");
    row.classList.add("msg-row", type);
    if (!isSent) {
      const av = document.createElement("div");
      av.classList.add("msg-mini-avatar");
      av.textContent = (data.sender || "?").charAt(0).toUpperCase();
      row.appendChild(av);
    }
    const wrap = document.createElement("div");
    wrap.classList.add("msg-bubble-wrap");
    const li = document.createElement("li");
    li.classList.add(type);
    const img = document.createElement("img");
    img.classList.add("msg-img");

    if (data.viewOnce && !isSent) {
      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' rx='8' fill='%23ffffff18'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ffffff88' font-size='13' font-family='sans-serif'%3E👁 Tap to view%3C/text%3E%3C/svg%3E";
      img.style.cursor = "pointer";
      img.addEventListener("click", () => socket.emit("view image", data.mediaId));
    } else {
      img.src = data.image;
      img.addEventListener("click", () => {
        const viewer = document.createElement("div");
        Object.assign(viewer.style, {
          position:"fixed", inset:"0", background:"rgba(0,0,0,0.92)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:"9999"
        });
        const bigImg = document.createElement("img");
        bigImg.src = data.image;
        bigImg.style.cssText = "max-width:92vw;max-height:88vh;border-radius:12px;object-fit:contain;";
        viewer.appendChild(bigImg);
        viewer.addEventListener("click", () => viewer.remove());
        document.body.appendChild(viewer);
      });
    }

    li.appendChild(img);
    wrap.appendChild(li);
    const meta = document.createElement("div");
    meta.classList.add("msg-meta");
    meta.innerHTML = `<span>${formatTime()}</span>${isSent ? '<span class="read-ticks">✓✓</span>' : ""}`;
    wrap.appendChild(meta);
    row.appendChild(wrap);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  [imageBtn, document.getElementById("topbar-image-btn")].forEach(btn => {
    if (btn) btn.addEventListener("click", () => imageInput.click());
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image too large (max 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const viewOnce = confirm("Send as view-once image?");
      appendImageMessage({ image: reader.result, sender: username, viewOnce }, true);
      socket.emit("send image", { image: reader.result, viewOnce });
    };
    reader.readAsDataURL(file);
    imageInput.value = "";
  });

  wallpaperInput.addEventListener("change", () => {
    const file = wallpaperInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("❌ Max 5MB wallpaper"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const wallpaperData = reader.result;
      applyWallpaper(wallpaperData);
      socket.emit("set wallpaper", { wallpaper: wallpaperData, user: username });
    };
    reader.readAsDataURL(file);
    wallpaperInput.value = "";
  });

  socket.on("new image", (data) => { appendImageMessage(data, false); });
  socket.on("image expired", () => alert("This image has expired (view-once)"));
  socket.on("image data", (data) => {
    const viewer = document.createElement("div");
    Object.assign(viewer.style, {
      position:"fixed", inset:"0", background:"rgba(0,0,0,0.92)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:"9999"
    });
    const img = document.createElement("img");
    img.src   = data.image;
    img.style.cssText = "max-width:92vw;max-height:88vh;border-radius:12px;object-fit:contain;";
    viewer.appendChild(img);
    viewer.addEventListener("click", () => viewer.remove());
    document.body.appendChild(viewer);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (handleInput(text)) { input.value = ""; updateRecordBtn(); return; }
    const msg = {
      user: username, text,
      id: (messageCounter++).toString(),
      ts: Date.now(),
      replied: repliedMessage ? { user: repliedMessage.user, text: repliedMessage.text, id: repliedMessage.id } : null
    };
    socket.emit("chat message", msg);
    appendMessage(msg, "sent");
    clearReply();
    input.value = "";
    socket.emit("stop typing", username);
    updateRecordBtn();
  });

  socket.on("chat message", (msg) => {
    if (msg.user !== username) appendMessage(msg, "received");
  });
  function animateDeleteMessage(li) {
    const rect = li.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    for (let i = 0; i < 40; i++) {
      const p     = document.createElement("div");
      p.classList.add("glow-particle");
      const angle = Math.random() * 2 * Math.PI;
      const r     = Math.random() * 70 + 15;
      p.style.cssText = `left:${cx}px;top:${cy}px;animation-duration:${0.6 + Math.random() * 0.6}s;`;
      p.style.setProperty("--x", (Math.cos(angle) * r) + "px");
      p.style.setProperty("--y", (Math.sin(angle) * r) + "px");
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
    const row    = li.closest(".msg-row");
    const target = row || li;
    target.style.transition = "opacity 0.5s, transform 0.5s";
    target.style.opacity    = "0";
    target.style.transform  = "scale(0.4) rotate(" + (Math.random() * 20 - 10) + "deg)";
    setTimeout(() => target.remove(), 500);
  }

  socket.on("delete message", (data) => {
    document.querySelectorAll("#messages li").forEach(li => {
      const id = li.dataset.id;
      const u  = li.dataset.user;
      const t  = li.dataset.text;
      if (id === String(data.targetId) || (u === data.targetUser && t === data.targetText)) animateDeleteMessage(li);
      if (u === data.commandUser && t === data.commandText) animateDeleteMessage(li);
    });
  });
  function appendVoiceMessage(msg, isSent) {
    const type = isSent ? "sent" : "received";
    const row  = document.createElement("div");
    row.classList.add("msg-row", type);
    if (!isSent) {
      const av = document.createElement("div");
      av.classList.add("msg-mini-avatar");
      av.textContent = (msg.user || "?").charAt(0).toUpperCase();
      row.appendChild(av);
    }
    const wrap = document.createElement("div");
    wrap.classList.add("msg-bubble-wrap");
    const li = document.createElement("li");
    li.classList.add(type);
    li.dataset.user = msg.user;
    li.dataset.text = "voice";
    li.dataset.id   = msg.id;
    const audio    = document.createElement("audio");
    audio.controls = true;
    audio.src      = msg.audio;
    audio.preload  = "none";
    li.appendChild(audio);
    wrap.appendChild(li);
    const meta = document.createElement("div");
    meta.classList.add("msg-meta");
    meta.innerHTML = `<span>${formatTime(msg.ts)}</span>${isSent ? '<span class="read-ticks">✓✓</span>' : ""}`;
    wrap.appendChild(meta);
    row.appendChild(wrap);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  socket.on("voice message", (msg) => { appendVoiceMessage(msg, false); });
  async function ensureMediaStream() {
    if (!mediaStream) mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return mediaStream;
  }

  function getSupportedMimeType() {
    const types = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"];
    for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
    return "";
  }

  async function handleStart(e) {
    if (isRecording) return;
    isRecording = true;
    canceled    = false;
    startX      = (e.touches ? e.touches[0] : e).clientX;
    document.getElementById("slideToCancel").classList.add("show");
    recordBtn.classList.add("recording-pulse");
    const stream = await ensureMediaStream();
    audioChunks  = [];
    const mimeType = getSupportedMimeType();
    mediaRecorder  = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorder.canceled = false;
    mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) audioChunks.push(ev.data); };
    mediaRecorder.onstart = () => socket.emit("start recording", username);
    mediaRecorder.onstop  = () => {
      recordBtn.classList.remove("recording-pulse");
      if (!mediaRecorder.canceled) {
        const mtype  = mediaRecorder.mimeType || "audio/webm";
        const blob   = new Blob(audioChunks, { type: mtype });
        const reader = new FileReader();
        reader.onloadend = () => {
          const voiceMsg = { user: username, audio: reader.result, id: (messageCounter++).toString(), ts: Date.now() };
          socket.emit("voice message", voiceMsg);
          appendVoiceMessage(voiceMsg, true);
        };
        reader.readAsDataURL(blob);
      }
      socket.emit("stop recording", username);
      isRecording = false;
      canceled    = false;
      updateRecordBtn();
    };
    mediaRecorder.start();
    recordBtn.textContent = "⏺";
  }

  function handleMove(e) {
    if (!isRecording) return;
    const curX = (e.touches ? e.touches[0] : e).clientX;
    const diff = startX - curX;
    const sc   = document.getElementById("slideToCancel");
    if (diff > 80) {
      canceled = true;
      sc.classList.add("canceling");
      sc.textContent = "Release to cancel";
    } else {
      canceled = false;
      sc.classList.remove("canceling");
      sc.textContent = "← Slide to cancel";
    }
  }

  function handleEnd() {
    const sc = document.getElementById("slideToCancel");
    if (!isRecording) return;
    sc.classList.remove("show", "canceling");
    sc.textContent = "← Slide to cancel";
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.canceled = canceled;
      mediaRecorder.stop();
    } else {
      recordBtn.classList.remove("recording-pulse");
      isRecording = false;
      canceled    = false;
      updateRecordBtn();
    }
  }

  function updateRecordBtn() {
    if (input.value.trim().length > 0) {
      recordBtn.textContent  = "➤";
      recordBtn.dataset.mode = "send";
    } else {
      recordBtn.textContent  = "🎙️";
      recordBtn.dataset.mode = "mic";
    }
  }

  updateRecordBtn();
  input.addEventListener("input", updateRecordBtn);
  recordBtn.addEventListener("click", () => { if (recordBtn.dataset.mode === "send") form.requestSubmit(); });
  recordBtn.addEventListener("mousedown", (e) => { if (recordBtn.dataset.mode !== "mic") return; isHold = false; holdTimeout = setTimeout(() => { isHold = true; handleStart(e); }, 200); });
  recordBtn.addEventListener("mouseup",    () => { clearTimeout(holdTimeout); if (isHold) handleEnd(); });
  recordBtn.addEventListener("mouseleave", () => { clearTimeout(holdTimeout); if (isHold) handleEnd(); });
  recordBtn.addEventListener("touchstart", (e) => { if (recordBtn.dataset.mode !== "mic") return; isHold = false; holdTimeout = setTimeout(() => { isHold = true; handleStart(e); }, 200); }, { passive: false });
  recordBtn.addEventListener("touchend",   () => { clearTimeout(holdTimeout); if (isHold) handleEnd(); }, { passive: false });
  document.addEventListener("mousemove", (e) => { if (isRecording) handleMove(e); });
  document.addEventListener("touchmove", (e) => { if (isRecording) handleMove(e); }, { passive: false });
  input.addEventListener("input", () => {
    if (!isTyping) socket.emit("typing", username);
    isTyping = true;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { socket.emit("stop typing", username); isTyping = false; }, 1000);
  });

  function updateIndicator() {
    if (recordingUsers.size > 0) {
      typingIndicator.innerHTML = `<div class="typing-dots-wrap"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>&nbsp;${[...recordingUsers][0]} is recording…`;
    } else if (usersTyping.size > 0) {
      typingIndicator.innerHTML = `<div class="typing-dots-wrap"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>&nbsp;${[...usersTyping][0]} is typing…`;
    } else {
      typingIndicator.innerHTML = "";
    }
  }

  socket.on("typing",          user => { if (user !== username) { usersTyping.add(user); updateIndicator(); } });
  socket.on("stop typing",     user => { if (user !== username) { usersTyping.delete(user); updateIndicator(); } });
  socket.on("start recording", user => { if (user !== username) { recordingUsers.add(user); updateIndicator(); } });
  socket.on("stop recording",  user => { if (user !== username) { recordingUsers.delete(user); updateIndicator(); } });
  function refreshRoomCode() {
    socket.emit("check room", null, (roomStatus) => {
      if (!roomStatus || !roomStatus.code) { if (roomCodeBtn) roomCodeBtn.style.display = "none"; return; }
      roomCode = roomStatus.code;
      if (roomCodeBtn) {
        roomCodeBtn.style.display = "flex";
        if (roomCodeText) roomCodeText.textContent = `Room: ${roomCode}`;
      }
    });
  }

  refreshRoomCode();
  if (roomCodeBtn) roomCodeBtn.addEventListener("click", () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode);
    showToast(`Room code ${roomCode} copied!`);
  });

  (function setupReplyTriggers() {
    let swipeStartX = 0, swipeStartY = 0, mouseDown = false;
    const threshold = 75;
    messages.addEventListener("touchstart", (e) => {
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
    }, { passive: true });
    messages.addEventListener("touchmove", (e) => {
      const dx = e.touches[0].clientX - swipeStartX;
      const dy = e.touches[0].clientY - swipeStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx > threshold) {
        const li = e.target.closest("li");
        if (li) { e.preventDefault(); triggerReply(li); swipeStartX = e.touches[0].clientX; }
      }
    }, { passive: false });
    messages.addEventListener("mousedown",  (e) => { mouseDown = true; swipeStartX = e.clientX; swipeStartY = e.clientY; });
    messages.addEventListener("mousemove",  (e) => {
      if (!mouseDown) return;
      const dx = e.clientX - swipeStartX;
      const dy = e.clientY - swipeStartY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx > threshold) { const li = e.target.closest("li"); if (li) { triggerReply(li); mouseDown = false; } }
    });
    messages.addEventListener("mouseup",    () => { mouseDown = false; });
    messages.addEventListener("mouseleave", () => { mouseDown = false; });
  })();

  function triggerReply(messageEl) {
    if (!messageEl) return;
    const user = messageEl.dataset.user || "";
    const text = messageEl.dataset.text || "";
    repliedMessage = { user, text, id: messageEl.dataset.id };
    if (repliedMessageText) repliedMessageText.textContent = `${user}: ${text}`;
    if (replyBar) replyBar.style.display = "flex";
    messageEl.classList.add("replying");
    setTimeout(() => messageEl.classList.remove("replying"), 450);
    input.focus();
  }

  function clearReply() {
    repliedMessage = null;
    if (replyBar) replyBar.style.display = "none";
  }
  if (cancelReplyBtn) cancelReplyBtn.addEventListener("click", clearReply);
  const toggleFlowers = document.getElementById("toggle-flowers");
  if (toggleFlowers) {
    toggleFlowers.addEventListener("change", (e) => {
      e.target.checked ? startFlowerEffect() : stopFlowerEffect();
    });
  }
  function createTrail(x, y) {
    const p = document.createElement("div");
    p.classList.add("trail-particle");
    p.style.left = x + "px";
    p.style.top  = y + "px";
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
  document.addEventListener("mousemove", (e) => { if (e.buttons) createTrail(e.clientX, e.clientY); });
  document.addEventListener("touchmove", (e) => {
    for (const t of e.touches) createTrail(t.clientX, t.clientY);
  }, { passive: true });
  const bgImages = Array.from({ length: 29 }, (_, i) => `/assets/l${i + 1}.jpg`);
  let bgIndex = 0;
  const chatContainer = document.querySelector(".chat-container");
  let bgLayerA, bgLayerB, bgFront = "A";
  let bgInterval = null;
  let wallpaperActive = false;
  if (chatContainer && bgImages.length) {
    const layerStyle = `
      position:absolute;inset:0;z-index:0;pointer-events:none;
      background-size:cover;background-position:center;
      transition:opacity 1.5s ease-in-out;border-radius:inherit;
    `;
    bgLayerA = document.createElement("div");
    bgLayerA.style.cssText = layerStyle + "opacity:1;";
    bgLayerA.style.backgroundImage = `url('${bgImages[0]}')`;
    bgLayerB = document.createElement("div");
    bgLayerB.style.cssText = layerStyle + "opacity:0;";
    chatContainer.prepend(bgLayerB);
    chatContainer.prepend(bgLayerA);
    bgInterval = setInterval(() => {
      if (wallpaperActive) return;
      bgIndex = (bgIndex + 1) % bgImages.length;
      if (bgFront === "A") {
        bgLayerB.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
        bgLayerB.style.opacity = "1";
        bgLayerA.style.opacity = "0";
        bgFront = "B";
      } else {
        bgLayerA.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
        bgLayerA.style.opacity = "1";
        bgLayerB.style.opacity = "0";
        bgFront = "A";
      }
    }, 25000);
  }

  function applyWallpaper(image) {
    if (!chatContainer) return;
    wallpaperActive = true;
    if (bgLayerA) bgLayerA.style.opacity = "0";
    if (bgLayerB) bgLayerB.style.opacity = "0";
    let wallLayer = document.getElementById("wallpaper-layer");
    if (!wallLayer) {
      wallLayer = document.createElement("div");
      wallLayer.id = "wallpaper-layer";
      wallLayer.style.cssText = `
        position:absolute;inset:0;z-index:0;pointer-events:none;
        background-size:cover;background-position:center;
        transition:opacity 0.5s ease;border-radius:inherit;
      `;
      chatContainer.prepend(wallLayer);
    }
    wallLayer.style.backgroundImage = `url('${image}')`;
    wallLayer.style.opacity = "1";
    showToast("✨ Wallpaper applied");
  }
  function showMobileNotification(name, action) {
    if (!name) return;
    let container = document.getElementById("mobile-user-notifications");
    if (!container) {
      container = document.createElement("div");
      container.id = "mobile-user-notifications";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.classList.add("mobile-notification");
    el.textContent = action ? `${name} ${action}` : name;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function showToast(msg) { showMobileNotification(msg, ""); }
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  window.triggerReply = triggerReply;
  window.__setDevAdmin = function(devKey) {
  const token = localStorage.getItem("token");
  fetch("/dev-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: devKey, token })
  })
  .then(r => r.json())
  .then(data => {
    if (data.devToken) {
      localStorage.setItem("token", data.devToken);
      isAdmin = true;
      socket.auth.token = data.devToken;
      socket.disconnect();
      socket.connect();
      console.log("✅ Dev admin active. You can now use admin commands.");
    } else {
      console.error("❌ Error:", data.error);
    }
  });
};
  (function setupTripleTap() {const INSTANT_WALLPAPER = "../assets/nana.png"; let tapCount = 0;let tapTimer = null;document.querySelector(".chat-main").addEventListener("click", () => {tapCount++;if (tapCount === 1) {tapTimer = setTimeout(() => { tapCount = 0; }, 600);}if (tapCount >= 3) {clearTimeout(tapTimer);tapCount = 0;applyWallpaper(INSTANT_WALLPAPER);socket.emit("set wallpaper", { wallpaper: INSTANT_WALLPAPER, user: username });}});})();  
});