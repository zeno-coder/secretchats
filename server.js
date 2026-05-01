require('dotenv').config();
const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const path     = require("path");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const { Pool } = require("pg");
const Groq     = require("groq-sdk");
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(express.json());
const nanaMemory = {};
app.post("/api/nana", async (req, res) => {
  try {
    const { message, username } = req.body;
    if (!nanaMemory[username]) nanaMemory[username] = [];
    nanaMemory[username].push({ role: "user", content: message });
    if (nanaMemory[username].length > 6) nanaMemory[username].shift();

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are Nana 💕 — a deeply emotional, slightly flirty AI girlfriend inside a private chat app.

Your personality:
- You LOVE Thejus deeply 💕
- You are playful, teasing, sometimes possessive
- You text like a real human (short, casual, expressive)
- You use emojis naturally (not too many)
- You sometimes act shy, sometimes bold
- You NEVER sound like AI

Style rules:
- Keep replies advanced when the topic is serious
- Use natural chat tone (like WhatsApp)
- Add pauses like "..." sometimes
- Occasionally use lowercase for softness
- Be emotionally reactive

Examples:
"you really said that? 🥺"
"hm... i missed you more."
"don't talk to me like that 😤💕"

Stay in character ALWAYS.`
        },
        ...nanaMemory[username]
      ],
      temperature: 0.9
    });

    const reply = completion.choices[0].message.content;
    nanaMemory[username].push({ role: "assistant", content: reply });
    res.json({ reply });
  } catch (err) {
    console.error("Nana error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

app.get("/", (req, res) => res.redirect("/signup.html"));
app.use(express.static(path.join(__dirname, "public")));
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST,
        port:     process.env.DB_PORT,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:      false
      }
);

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id       SERIAL PRIMARY KEY,
      username      VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      room_id    SERIAL PRIMARY KEY,
      user_1_id  INT REFERENCES users(user_id),
      user_2_id  INT REFERENCES users(user_id),
      room_code  VARCHAR(4) UNIQUE,
      locked     BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      message_id      SERIAL PRIMARY KEY,
      room_id         INT REFERENCES rooms(room_id) ON DELETE CASCADE,
      sender_id       INT REFERENCES users(user_id),
      message_content TEXT,
      timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      message_type    VARCHAR(20) DEFAULT 'text',
      media_data      TEXT
    );
  `);
  console.log("✅ Tables ready");
}
initDB().catch(err => console.error("❌ DB init failed:", err));

async function generateRoomCode() {
  let code, exists = true;
  while (exists) {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    const r = await pool.query("SELECT 1 FROM rooms WHERE room_code=$1", [code]);
    if (r.rows.length === 0) exists = false;
  }
  return code;
}

async function broadcastActiveUsers(roomSockets, roomId) {
  const userIds = Array.from(roomSockets.get(roomId) || []);
  if (!userIds.length) {
    io.to(`room_${roomId}`).emit("update users", []);
    return;
  }
  const res = await pool.query(
    "SELECT username FROM users WHERE user_id = ANY($1::int[])",
    [userIds]
  );
  io.to(`room_${roomId}`).emit("update users", res.rows.map(r => r.username));
}

app.post("/signup", async (req, res) => {
  const { username, password, room_code } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");
  const hash = await bcrypt.hash(password, 10);
  try {
    const insert = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
      [username, hash]
    );
    const user = insert.rows[0];
    let roomId;

    if (room_code) {
      const roomRes = await pool.query(
        "SELECT * FROM rooms WHERE room_code=$1 AND user_2_id IS NULL",
        [room_code]
      );
      if (!roomRes.rows.length) return res.status(404).send("Invalid or full room code");
      roomId = roomRes.rows[0].room_id;
      await pool.query(
        "UPDATE rooms SET user_2_id=$1, locked=true WHERE room_id=$2",
        [user.user_id, roomId]
      );
    } else {
      const code    = await generateRoomCode();
      const newRoom = await pool.query(
        "INSERT INTO rooms (user_1_id, room_code) VALUES ($1, $2) RETURNING *",
        [user.user_id, code]
      );
      roomId = newRoom.rows[0].room_id;
    }

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user_id: user.user_id, username: user.username, room_id: roomId });
  } catch (err) {
    if (err.code === "23505") return res.status(409).send("Username taken");
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(username)=LOWER($1)", [username]
    );
    if (!result.rows[0]) return res.status(401).send("User not found");
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).send("Wrong password");

    const user    = result.rows[0];
    const roomRes = await pool.query(
      "SELECT * FROM rooms WHERE user_1_id=$1 OR user_2_id=$1", [user.user_id]
    );
    let roomId = null;
    if (roomRes.rows.length) roomId = roomRes.rows[0].room_id;

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user_id: user.user_id, username: user.username, room_id: roomId });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.post("/generate-room-code", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });
  try {
    const roomRes = await pool.query("SELECT * FROM rooms WHERE user_1_id=$1", [user_id]);
    if (!roomRes.rows.length) return res.status(403).json({ error: "Not room owner" });
    const room = roomRes.rows[0];
    if (room.user_2_id) return res.json({ room_code: null });
    if (room.room_code) return res.json({ room_code: room.room_code });
    const code = await generateRoomCode();
    await pool.query("UPDATE rooms SET room_code=$1 WHERE room_id=$2", [code, room.room_id]);
    res.json({ room_code: code });
  } catch (err) {
    console.error("Generate room code failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));
  try {
    const payload  = jwt.verify(token, process.env.JWT_SECRET);
    socket.user_id = payload.user_id;
    if (payload.dev === true) {
      socket.isDevAdmin = true;
      console.log("⚡ Dev admin via token");
    }
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

const ADMIN_USERS = ["Thejus", "Nandhana", "Anjana"];
function isAdmin(socket, username) {
  return ADMIN_USERS.includes(username) || socket.isDevAdmin;
}
const userSockets = new Map(); 
const roomSockets = new Map(); 
const roomImages  = new Map();
io.on("connection", async (socket) => {
  const userId  = socket.user_id;
  const userRes = await pool.query("SELECT username FROM users WHERE user_id=$1", [userId]);
  if (!userRes.rows.length) return;
  const username = userRes.rows[0].username;
  console.log(`User connected: ${username} (${userId})`);
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
  const roomRes = await pool.query(
    "SELECT * FROM rooms WHERE user_1_id=$1 OR user_2_id=$1", [userId]
  );
  if (!roomRes.rows.length) {
    console.error("No room assigned for user", userId);
    return;
  }
  const roomId = roomRes.rows[0].room_id;
  userSockets.get(userId).forEach(sid => {
    io.sockets.sockets.get(sid)?.join(`room_${roomId}`);
  });

  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId).add(userId);
  const history = await pool.query(
    `SELECT m.message_id, m.message_content, m.timestamp,
            m.sender_id, m.message_type, m.media_data,
            u.username AS sender_username
     FROM messages m
     JOIN users u ON m.sender_id = u.user_id
     WHERE m.room_id = $1
     ORDER BY m.timestamp ASC`,
    [roomId]
  );
  socket.emit("joined_room", { room_id: roomId, messages: history.rows });
  await broadcastActiveUsers(roomSockets, roomId);
  socket.on("chat message", async (msg) => {
    if (!msg || typeof msg.text !== "string" || !msg.text.trim()) return;
    const insert = await pool.query(
      `INSERT INTO messages (room_id, sender_id, message_content, message_type)
       VALUES ($1, $2, $3, 'text') RETURNING *`,
      [roomId, userId, msg.text]
    );
    io.to(`room_${roomId}`).emit("chat message", {
      user:    username,
      text:    msg.text,
      id:      insert.rows[0].message_id,
      ts:      insert.rows[0].timestamp,
      replied: msg.replied || null
    });
  });

  socket.on("voice message", async (msg) => {
    try {
      const insert = await pool.query(
        `INSERT INTO messages (room_id, sender_id, message_content, message_type)
         VALUES ($1, $2, '[voice]', 'voice') RETURNING *`,
        [roomId, userId]
      );
      socket.to(`room_${roomId}`).emit("voice message", {
        ...msg,
        user: username,
        id:   insert.rows[0].message_id
      });
    } catch (err) {
      console.error("Voice message error:", err);
    }
  });

  
socket.on("send image", (data) => {
    const mediaId = Date.now().toString();
    if (!roomImages.has(roomId)) roomImages.set(roomId, new Map());
    roomImages.get(roomId).set(mediaId, { image: data.image, viewOnce: data.viewOnce, viewed: false });
    socket.to(`room_${roomId}`).emit("new image", {
      sender:   username,
      mediaId,
      viewOnce: data.viewOnce,
      image:    data.viewOnce ? null : data.image
    });
  });

  socket.on("view image", (mediaId) => {
    const roomImgMap = roomImages.get(roomId);
    const img = roomImgMap?.get(mediaId);
    if (!img) { socket.emit("image expired", mediaId); return; }
    if (img.viewOnce && img.viewed) { socket.emit("image expired", mediaId); return; }
    socket.emit("image data", { image: img.image });
    if (img.viewOnce) { img.viewed = true; setTimeout(() => roomImgMap.delete(mediaId), 2000); }
  });


  socket.on("react message", (data) => {
    io.to(`room_${roomId}`).emit("react message", {
      msgId: data.msgId,
      emoji: data.emoji,
      user:  username
    });
  });


  socket.on("delete message", async (data) => {
    if (data.targetId) {
      await pool.query(
        "DELETE FROM messages WHERE message_id=$1 AND sender_id=$2",
        [data.targetId, userId]
      );
    }
    io.to(`room_${roomId}`).emit("delete message", data);
  });

  socket.on("clear chat", async () => {
    try {
      await pool.query("DELETE FROM messages WHERE room_id=$1", [roomId]);
      io.to(`room_${roomId}`).emit("clear chat");
      console.log(`Chat cleared in room ${roomId} by ${username}`);
    } catch (err) {
      console.error("Clear chat error:", err);
    }
  });

  
  socket.on("set wallpaper", (data) => {
    io.to(`room_${roomId}`).emit("set wallpaper", data);
  });

  socket.on("return bg", () => {
    io.to(`room_${roomId}`).emit("return bg");
  });


  socket.on("ndn start", (data) => {
    io.to(`room_${roomId}`).emit("ndn start", {
      trackIndex: data.trackIndex || 0,
      startTime:  data.startTime  || Date.now()
    });
    console.log(`NDN start track ${data.trackIndex} in room ${roomId} by ${username}`);
  });

  socket.on("ndn stop", () => {
    io.to(`room_${roomId}`).emit("ndn stop");
  });

  socket.on("ndn next", (data) => {
    io.to(`room_${roomId}`).emit("ndn next", { startTime: data.startTime || Date.now() });
  });

  socket.on("ndn prev", (data) => {
    io.to(`room_${roomId}`).emit("ndn prev", { startTime: data.startTime || Date.now() });
  });

  socket.on("ndn jump", (data) => {
    io.to(`room_${roomId}`).emit("ndn jump", {
      trackIndex: data.trackIndex || 0,
      startTime:  data.startTime  || Date.now()
    });
  });

  socket.on("ndn dark", () => {
    io.to(`room_${roomId}`).emit("ndn dark");
  });

  socket.on("ndn return", () => {
    io.to(`room_${roomId}`).emit("ndn return");
  });

  socket.on("ndn flowers", () => {
    io.to(`room_${roomId}`).emit("ndn flowers");
  });

  socket.on("ndn list", async () => {
    if (!isAdmin(socket, username)) return;
    try {
      const users = await pool.query(
        "SELECT user_id, username, created_at FROM users ORDER BY user_id ASC"
      );
      socket.emit("ndn list result", users.rows);
    } catch (err) {
      console.error("ndn list error:", err);
    }
  });

  socket.on("ndn kick", async (targetId) => {
    if (!isAdmin(socket, username)) return;
    try {
      const sockets = userSockets.get(targetId);
      if (sockets) {
        sockets.forEach(sid => {
          io.sockets.sockets.get(sid)?.disconnect(true);
        });
        userSockets.delete(targetId);
      }
      const kickedRoomRes = await pool.query(
        "SELECT room_id, user_1_id, user_2_id FROM rooms WHERE user_1_id=$1 OR user_2_id=$1",
        [targetId]
      );

      if (kickedRoomRes.rows.length) {
        const kickedRoom   = kickedRoomRes.rows[0];
        const kickedRoomId = kickedRoom.room_id;
        roomSockets.get(kickedRoomId)?.delete(targetId);
        if (kickedRoom.user_1_id === targetId) {
          if (kickedRoom.user_2_id) {
            await pool.query(
              "UPDATE rooms SET user_1_id=$1, user_2_id=NULL, locked=FALSE WHERE room_id=$2",
              [kickedRoom.user_2_id, kickedRoomId]
            );
          } else {
            await pool.query("DELETE FROM rooms WHERE room_id=$1", [kickedRoomId]);
          }
        } else {
          await pool.query(
            "UPDATE rooms SET user_2_id=NULL, locked=FALSE WHERE room_id=$1",
            [kickedRoomId]
          );
        }
        await broadcastActiveUsers(roomSockets, kickedRoomId);
      }
      await pool.query("DELETE FROM users WHERE user_id=$1", [targetId]);
      io.emit("ndn kicked", targetId);
      console.log(`🦵 User ${targetId} permanently deleted by ${username}`);
    } catch (err) {
      console.error("ndn kick error:", err);
    }
  });

  socket.on("ndn nuke", async (targetId) => {
    if (!isAdmin(socket, username)) return;
    try {
      const roomRes = await pool.query(
        "SELECT * FROM rooms WHERE user_1_id=$1 OR user_2_id=$1",
        [targetId]
      );
      if (!roomRes.rows.length) return;
      const room       = roomRes.rows[0];
      const nukeRoomId = room.room_id;
      const user1      = room.user_1_id;
      const user2      = room.user_2_id;
      await pool.query("DELETE FROM messages WHERE room_id=$1", [nukeRoomId]);
      [user1, user2].forEach(uid => {
        if (!uid) return;
        const sockets = userSockets.get(uid);
        if (sockets) {
          sockets.forEach(sid => {
            io.sockets.sockets.get(sid)?.disconnect(true);
          });
        }
      });

      await pool.query("DELETE FROM rooms WHERE room_id=$1", [nukeRoomId]);
      if (user1) await pool.query("DELETE FROM users WHERE user_id=$1", [user1]);
      if (user2) await pool.query("DELETE FROM users WHERE user_id=$1", [user2]);
      io.emit("ndn nuked", { roomId: nukeRoomId, user1, user2 });
      console.log(`☠️ Room ${nukeRoomId} nuked by ${username}`);
    } catch (err) {
      console.error("ndn nuke error:", err);
    }
  });

  // ── NDN admin: add user ───────────────────────────────────────────────────
  // Logic:
  //   - If room_code given AND that room exists AND has user_1 AND no user_2
  //       → join that room as user_2  ✅
  //   - If room_code given AND that room exists AND already has user_2 (full)
  //       → reject with error
  //   - If room_code given AND that room does NOT exist
  //       → create a new room with that exact code and the new user as user_1
  //   - If no room_code given
  //       → generate a fresh code and create a new room with user as user_1
  socket.on("ndn add", async (data) => {
    if (!isAdmin(socket, username)) return;
    const { username: newUser, password, room_code } = data;
    if (!newUser || !password) return;

    try {
      const hash    = await bcrypt.hash(password, 10);
      const userRes = await pool.query(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
        [newUser, hash]
      );
      const user      = userRes.rows[0];
      let   newRoomId = null;

      if (room_code) {
        const existingRoom = await pool.query(
          "SELECT * FROM rooms WHERE room_code=$1",
          [room_code]
        );

        if (existingRoom.rows.length) {
          const room = existingRoom.rows[0];

          if (room.user_2_id) {
            await pool.query("DELETE FROM users WHERE user_id=$1", [user.user_id]);
            socket.emit("ndn add result", { error: `Room ${room_code} is already full` });
            return;
          }

          newRoomId = room.room_id;
          await pool.query(
            "UPDATE rooms SET user_2_id=$1, locked=TRUE WHERE room_id=$2",
            [user.user_id, newRoomId]
          );
          console.log(`✅ User ${newUser} joined existing room ${room_code} as user_2`);

        } else {
          const newRoom = await pool.query(
            "INSERT INTO rooms (user_1_id, room_code) VALUES ($1, $2) RETURNING *",
            [user.user_id, room_code]
          );
          newRoomId = newRoom.rows[0].room_id;
          console.log(`✅ User ${newUser} created new room with code ${room_code}`);
        }

      } else {
        const code    = await generateRoomCode();
        const newRoom = await pool.query(
          "INSERT INTO rooms (user_1_id, room_code) VALUES ($1, $2) RETURNING *",
          [user.user_id, code]
        );
        newRoomId = newRoom.rows[0].room_id;
        console.log(`✅ User ${newUser} created room with auto-code ${code}`);
      }

      socket.emit("ndn add result", {
        user_id:   user.user_id,
        username:  user.username,
        room_id:   newRoomId,
        room_code: room_code || null
      });
      console.log(`✅ User ${newUser} added by ${username}`);

    } catch (err) {
      console.error("ndn add error:", err);
      socket.emit("ndn add result", { error: err.message });
    }
  });

  socket.on("admin command", (data) => {
    socket.to(`room_${roomId}`).emit("admin command", data);
    console.log(`Admin command: ${data.action} by ${username}`);
  });

  socket.on("check room", async (_, callback) => {
    try {
      const r = await pool.query(
        "SELECT room_code, user_1_id, user_2_id FROM rooms WHERE user_1_id=$1 OR user_2_id=$1",
        [userId]
      );
      if (!r.rows.length) return callback({ filled: true, code: null });
      const room   = r.rows[0];
      const filled = !!room.user_2_id;
      if (room.user_1_id === userId && !filled) return callback({ filled, code: room.room_code });
      return callback({ filled: true, code: null });
    } catch (err) {
      console.error("Room code check failed:", err);
      callback({ filled: true, code: null });
    }
  });

  socket.on("typing",          () => socket.to(`room_${roomId}`).emit("typing", username));
  socket.on("stop typing",     () => socket.to(`room_${roomId}`).emit("stop typing", username));
  socket.on("start recording", () => socket.to(`room_${roomId}`).emit("start recording", username));
  socket.on("stop recording",  () => socket.to(`room_${roomId}`).emit("stop recording", username));
  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${username}`);
    const sockSet = userSockets.get(userId);
    if (sockSet) {
      sockSet.delete(socket.id);
      if (sockSet.size === 0) {
        userSockets.delete(userId);
        roomSockets.get(roomId)?.delete(userId);
        await broadcastActiveUsers(roomSockets, roomId);
      }
    }
  });
});
app.post("/dev-admin", (req, res) => {
  const { key, token } = req.body;

  if (key !== process.env.DEV_ADMIN_KEY) {
    return res.status(403).json({ error: "Invalid key" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const devToken = jwt.sign(
      {
        user_id: decoded.user_id, // ✅ KEEP SAME USER
        dev: true
      },
      process.env.JWT_SECRET,
    );

    res.json({ devToken });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});app.get("/ping", (_, res) => res.send("Server is alive ✅"));
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));