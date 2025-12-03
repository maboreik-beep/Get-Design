import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { GoogleGenAI } from '@google/genai';

// --- Configuration ---
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this-in-env';

// Get Directory Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit payload size for performance
app.use(express.urlencoded({ extended: true }));

// --- Database Setup (Render.com Persistent Disk Support) ---
const PERSISTENT_DATA_DIR = process.env.RENDER_DISK_PATH || path.join(__dirname, '..', 'data');
if (!fs.existsSync(PERSISTENT_DATA_DIR)) {
  console.log(`Creating data directory: ${PERSISTENT_DATA_DIR}`);
  fs.mkdirSync(PERSISTENT_DATA_DIR, { recursive: true });
}
const dbPath = path.join(PERSISTENT_DATA_DIR, 'crm.sqlite');

let db;

async function initializeDatabase() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  console.log(`Connected to database at ${dbPath}`);

  // 1. Users Table (Admin, Coordinator, Designer)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL, -- using email as username
      password TEXT NOT NULL, -- Storing plain text for simplicity as requested, use bcrypt in real prod
      role TEXT NOT NULL CHECK(role IN ('admin', 'designer', 'coordinator')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Leads Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      design_interest TEXT,
      status TEXT DEFAULT 'new', -- new, contacted, in_progress, closed
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Templates Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      url TEXT NOT NULL, -- Link to Canva, Figma, or Image URL
      thumbnail_url TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Initial Users if Empty
  const userCount = await db.get("SELECT COUNT(*) as count FROM Users");
  if (userCount.count === 0) {
    console.log("Seeding default users...");
    await db.run("INSERT INTO Users (username, password, role) VALUES (?, ?, ?)", 'admin@getdesign.cloud', 'admin123', 'admin');
    await db.run("INSERT INTO Users (username, password, role) VALUES (?, ?, ?)", 'coord@getdesign.cloud', 'coord123', 'coordinator');
    await db.run("INSERT INTO Users (username, password, role) VALUES (?, ?, ?)", 'design@getdesign.cloud', 'design123', 'designer');
  }
}

initializeDatabase().catch(err => {
  console.error("DB Init Failed:", err);
  process.exit(1);
});

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied for this role" });
    }
    next();
  };
};

// --- Routes ---

// 1. Public: Contact / Lead Generation
app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, design_interest } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Name and Email required" });

  try {
    await db.run(
      "INSERT INTO Leads (name, company, email, phone, design_interest) VALUES (?, ?, ?, ?, ?)",
      name, company, email, phone, design_interest
    );
    res.status(201).json({ message: "Lead saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get("SELECT * FROM Users WHERE username = ?", username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Generate Token
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Auth failed" });
  }
});

// 3. Leads Management (Admin & Coordinator)
app.get('/api/leads', authenticateToken, requireRole(['admin', 'coordinator', 'designer']), async (req, res) => {
  try {
    const leads = await db.all("SELECT * FROM Leads ORDER BY created_at DESC");
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

app.put('/api/leads/:id', authenticateToken, requireRole(['admin', 'coordinator']), async (req, res) => {
  const { status, notes } = req.body;
  try {
    await db.run("UPDATE Leads SET status = ?, notes = ? WHERE id = ?", status, notes, req.params.id);
    res.json({ message: "Lead updated" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete('/api/leads/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await db.run("DELETE FROM Leads WHERE id = ?", req.params.id);
    res.json({ message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// 4. Excel Export (Coordinator & Admin)
app.get('/api/leads/export', authenticateToken, requireRole(['admin', 'coordinator']), async (req, res) => {
  try {
    const leads = await db.all("SELECT * FROM Leads ORDER BY created_at DESC");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');
    
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Company', key: 'company', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Interest', key: 'design_interest', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];
    worksheet.addRows(leads);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

// 5. Template Management (Admin & Designer)
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const templates = await db.all("SELECT * FROM Templates ORDER BY created_at DESC");
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post('/api/templates', authenticateToken, requireRole(['admin', 'designer']), async (req, res) => {
  const { title, category, url, thumbnail_url } = req.body;
  try {
    await db.run(
      "INSERT INTO Templates (title, category, url, thumbnail_url, created_by) VALUES (?, ?, ?, ?, ?)",
      title, category, url, thumbnail_url, req.user.id
    );
    res.status(201).json({ message: "Template added" });
  } catch (err) {
    res.status(500).json({ error: "Add failed" });
  }
});

app.delete('/api/templates/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await db.run("DELETE FROM Templates WHERE id = ?", req.params.id);
    res.json({ message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// 6. User Management (Admin Only)
app.get('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await db.all("SELECT id, username, role, created_at FROM Users");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Fetch users failed" });
  }
});

app.post('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { username, password, role } = req.body;
  try {
    await db.run("INSERT INTO Users (username, password, role) VALUES (?, ?, ?)", username, password, role);
    res.status(201).json({ message: "User created" });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: "Username taken" });
    res.status(500).json({ error: "Create failed" });
  }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({error: "Cannot delete self"});
  try {
    await db.run("DELETE FROM Users WHERE id = ?", req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// 7. AI Generation Proxy (Simplified)
// This endpoint is for the frontend to call Gemini. 
// It doesn't save to DB or parse files heavily to keep backend simple.
app.post('/api/generate-design', async (req, res) => {
  // Simple proxy if you want to keep API Key hidden on server
  // OR the frontend can call Gemini directly if you are okay with exposing key or using a proxy
  // Given user request for simplicity, let's keep basic proxy but remove DB/File logic.
  
  // Note: For this simplified version, we are assuming the Frontend sends the data 
  // and we just pass it to Gemini SDK if needed, OR we just let the frontend do it via API.
  // But standard practice: Backend holds API Key.
  
  if (!process.env.API_KEY) return res.status(500).json({error: "API Key missing"});
  
  // Implementation of specific AI logic can be added here if needed, 
  // but simpler to handle logic on frontend and just use this to sign/proxy.
  // For now, returning success to allow frontend 'simulated' generation if preferred, 
  // or you can port the generation logic here without the heavy file saving.
  
  // Minimal Implementation:
  try {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     // ... extract prompt from req.body ...
     // ... ai.models.generateContent ...
     // This part depends on how much logic you want to move back here. 
     // For "Simple", we can leave this open or unimplemented until AI specific task arises.
     res.json({ message: "AI Generation Endpoint Ready" });
  } catch(e) {
     res.status(500).json({ error: e.message });
  }
});

// --- Frontend Serving ---
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --- Start ---
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
