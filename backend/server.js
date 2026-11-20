require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const chain = require("./blockchain");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET is missing or too short. Check your .env file.");
  process.exit(1);
}

const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(function (o) { return o.trim(); })
  .filter(Boolean);

const DOCUMENT_TYPES = [
  "Transcript of Records",
  "Certificate of Enrollment",
  "Certificate of Grades",
  "Good Moral Certificate",
  "Diploma"
];

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

function detectType(buf) {
  if (buf.length < 4) return null;

  if (buf.slice(0, 4).toString("latin1") === "%PDF") {
    return { mime: "application/pdf", ext: ".pdf" };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", ext: ".png" };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  return null;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function removeFile(name) {
  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, name));
  } catch (error) {
  }
}

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  exposedHeaders: ["X-File-Intact"]
}));

app.use(express.json({ limit: "100kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many failed login attempts. Try again in 15 minutes." }
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification requests. Please wait a moment." }
});

async function logActivity(userId, userName, action, details) {
  try {
    await db.query(
      "INSERT INTO activity_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)",
      [userId, userName, action, details ? String(details).slice(0, 255) : null]
    );
  } catch (error) {
    console.error("Could not write activity log:", error.message);
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, first_name, role, is_active FROM users WHERE id = ?",
      [payload.id]
    );

    const user = rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Account is disabled or no longer exists." });
    }

    req.user = { id: user.id, role: user.role, firstName: user.first_name };
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Administrators only." });
  }
  next();
}

app.get("/", function (req, res) {
  res.send("CHAIN-REC backend is running!");
});

app.post("/api/login", loginLimiter, async function (req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const role = req.body.role;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  if (email.length > 150 || password.length > 100) {
    return res.status(400).json({ message: "Invalid email or password." });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ? AND is_active = 1",
      [email]
    );

    const user = rows[0];
    const valid = user && (await bcrypt.compare(password, user.password_hash));

    if (!valid || (role && user.role !== role)) {
      await logActivity(null, "Unknown", "LOGIN_FAILED", "Email tried: " + email);
      return res.status(401).json({ message: "Invalid email, password, or role." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, firstName: user.first_name },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    await logActivity(user.id, user.first_name, "LOGIN", "Signed in as " + user.role);

    res.json({
      token: token,
      firstName: user.first_name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/register", requireAuth, upload.single("file"), async function (req, res) {
  const student = String(req.body.student || "").trim();
  const studentNo = String(req.body.studentNo || "").trim();
  const type = String(req.body.type || "");
  const date = String(req.body.date || "");
  const fileName = String(req.body.fileName || "").slice(0, 255);
  const clientHash = String(req.body.hash || "").toLowerCase();

  if (!student || !studentNo || !type || !date || !clientHash) {
    return res.status(400).json({ message: "Missing required fields." });
  }
  if (student.length > 150 || studentNo.length > 50) {
    return res.status(400).json({ message: "Student name or number is too long." });
  }
  if (!DOCUMENT_TYPES.includes(type)) {
    return res.status(400).json({ message: "Unknown document type." });
  }
  if (!DATE_PATTERN.test(date)) {
    return res.status(400).json({ message: "Invalid date." });
  }
  if (!HASH_PATTERN.test(clientHash)) {
    return res.status(400).json({ message: "Invalid document hash." });
  }
  if (!req.file) {
    return res.status(400).json({ message: "Please attach the document file." });
  }

  const kind = detectType(req.file.buffer);
  if (!kind) {
    return res.status(400).json({ message: "Only PDF, JPG, or PNG files are allowed." });
  }

  const hash = sha256(req.file.buffer);
  if (hash !== clientHash) {
    return res.status(400).json({ message: "The file does not match its hash. Choose the file again." });
  }

  let storedName = null;

  try {
    const [existing] = await db.query("SELECT id FROM documents WHERE doc_hash = ?", [hash]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "This document is already registered." });
    }

    storedName = crypto.randomUUID() + kind.ext;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), req.file.buffer);

    let proof;
    try {
      proof = await chain.storeOnChain(hash);
    } catch (chainError) {
      console.error("Blockchain error:", chainError.shortMessage || chainError.message);
      await removeFile(storedName);
      return res.status(502).json({
        message: "Could not write to the blockchain. Is the blockchain node running?"
      });
    }

    await db.query(
      `INSERT INTO documents
       (student_name, student_no, doc_type, date_issued, file_name, doc_hash,
        tx_hash, block_number, stored_file, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student, studentNo, type, date, fileName, hash,
       proof.txHash, proof.block, storedName, kind.mime]
    );

    await logActivity(req.user.id, req.user.firstName, "REGISTER_DOCUMENT",
      type + " for " + student + " (block " + proof.block + ")");

    res.status(201).json({
      message: "Document registered.",
      hash: hash,
      txHash: proof.txHash,
      block: proof.block
    });
  } catch (error) {
    if (storedName) await removeFile(storedName);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "This document is already registered." });
    }
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.post("/api/verify", verifyLimiter, async function (req, res) {
  const hash = String(req.body.hash || "").toLowerCase();

  if (!HASH_PATTERN.test(hash)) {
    return res.status(400).json({ message: "Invalid document hash." });
  }

  try {
    const onChain = await chain.verifyOnChain(hash);
    const shortHash = hash.slice(0, 10) + "…";

    if (!onChain.exists) {
      await logActivity(null, "Public", "VERIFY_NOT_FOUND", "Hash " + shortHash);
      return res.json({ found: false });
    }

    const [rows] = await db.query(
      "SELECT doc_type, date_issued FROM documents WHERE doc_hash = ?",
      [hash]
    );

    await logActivity(null, "Public", "VERIFY_AUTHENTIC", "Hash " + shortHash);

    res.json({
      found: true,
      type: rows[0] ? rows[0].doc_type : "Document",
      date: rows[0]
        ? rows[0].date_issued
        : new Date(onChain.timestamp * 1000).toISOString().slice(0, 10),
      registeredOn: new Date(onChain.timestamp * 1000).toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Could not reach the blockchain." });
  }
});

app.get("/api/documents", requireAuth, async function (req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, student_name AS student, student_no AS studentNo,
              doc_type AS type, date_issued AS date,
              file_name AS fileName, doc_hash AS hash,
              tx_hash AS txHash, block_number AS block,
              (stored_file IS NOT NULL) AS hasFile,
              registered_at AS registeredAt
       FROM documents ORDER BY id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.get("/api/documents/:id/file", requireAuth, async function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid record." });
  }

  try {
    const [rows] = await db.query(
      `SELECT student_name, doc_type, doc_hash, stored_file, mime_type
       FROM documents WHERE id = ?`,
      [id]
    );

    const rec = rows[0];

    if (!rec || !rec.stored_file) {
      return res.status(404).json({ message: "No file is stored for this record." });
    }

    const filePath = path.join(UPLOAD_DIR, path.basename(rec.stored_file));
    const buffer = await fs.promises.readFile(filePath);

    const intact = sha256(buffer) === rec.doc_hash;

    await logActivity(req.user.id, req.user.firstName, "VIEW_FILE",
      rec.doc_type + " for " + rec.student_name + (intact ? "" : " (HASH MISMATCH)"));

    res.setHeader("X-File-Intact", intact ? "true" : "false");
    res.setHeader("Content-Type", rec.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ message: "The stored file is missing from the server." });
    }
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

app.get("/api/stats", requireAuth, async function (req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(DATE(registered_at) = CURDATE()), 0) AS today,
         COALESCE(SUM(YEAR(registered_at) = YEAR(CURDATE())
                  AND MONTH(registered_at) = MONTH(CURDATE())), 0) AS month,
         COUNT(DISTINCT doc_type) AS types
       FROM documents`
    );

    res.json({
      total: Number(rows[0].total),
      today: Number(rows[0].today),
      month: Number(rows[0].month),
      types: Number(rows[0].types)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.get("/api/chain-status", requireAuth, async function (req, res) {
  try {
    res.json(await chain.chainStatus());
  } catch (error) {
    res.json({ network: "Not connected", block: 0, total: 0, contract: "-" });
  }
});

app.get("/api/logs", requireAuth, async function (req, res) {
  try {
    let sql =
      `SELECT id, user_name AS userName, action, details, created_at AS createdAt
       FROM activity_logs`;
    const params = [];

    if (req.user.role !== "admin") {
      sql += " WHERE user_id = ?";
      params.push(req.user.id);
    }

    sql += " ORDER BY id DESC LIMIT 500";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.get("/api/users", requireAuth, requireAdmin, async function (req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, first_name AS firstName, last_name AS lastName,
              email, role, is_active AS isActive, created_at AS createdAt
       FROM users ORDER BY id DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.post("/api/users", requireAuth, requireAdmin, async function (req, res) {
  const firstName = String(req.body.firstName || "").trim();
  const lastName = String(req.body.lastName || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (firstName.length > 80 || lastName.length > 80 || email.length > 150) {
    return res.status(400).json({ message: "One of the fields is too long." });
  }

  if (!email.includes("@")) {
    return res.status(400).json({ message: "Enter a valid email." });
  }

  if (password.length < 8 || password.length > 100) {
    return res.status(400).json({ message: "Password must be 8 to 100 characters." });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'staff')`,
      [firstName, lastName, email, hash]
    );

    await logActivity(req.user.id, req.user.firstName, "CREATE_USER", "Staff account: " + email);

    res.status(201).json({ message: "Staff account created." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "That email is already used." });
    }
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.patch("/api/users/:id/status", requireAuth, requireAdmin, async function (req, res) {
  const id = Number(req.params.id);
  const isActive = req.body.isActive ? 1 : 0;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid account." });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: "You cannot disable your own account." });
  }

  try {
    await db.query("UPDATE users SET is_active = ? WHERE id = ?", [isActive, id]);

    await logActivity(
      req.user.id,
      req.user.firstName,
      isActive ? "ENABLE_USER" : "DISABLE_USER",
      "Account ID " + id
    );

    res.json({ message: "Account updated." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error." });
  }
});

app.use(function (err, req, res, next) {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "This origin is not allowed." });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File is too large. The maximum is 10 MB." });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: "Upload error. Please try again." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid request." });
  }
  console.error(err);
  res.status(500).json({ message: "Server error." });
});

app.listen(PORT, function () {
  console.log("Server running at http://localhost:" + PORT);
});