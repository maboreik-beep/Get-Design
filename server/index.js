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
import multer from 'multer';
import fetch from 'node-fetch';
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
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer Setup (Memory Storage for processing before sending to AI)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- Database Setup ---
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

  // 1. Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL, 
      password TEXT NOT NULL, 
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
      status TEXT DEFAULT 'new',
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
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Design Tasks Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS DesignTasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
      assigned_to INTEGER, -- User ID
      reference_template_id INTEGER,
      output_url TEXT,
      request_details TEXT, -- JSON string of requirements
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lead_id) REFERENCES Leads(id),
      FOREIGN KEY(assigned_to) REFERENCES Users(id)
    );
  `);

  // Seed Users
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

// --- Helper: AI Generation Logic (Gemini 2.5) ---
async function handleAIGeneration(type, businessData, files, db) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });
  
  // Parse Business Data
  const data = JSON.parse(businessData);
  const { name, industry, description, visualStyle, customColorPalette, templateId } = data;

  // Fetch Template Reference if exists
  let referenceImagePart = null;
  let referenceUrl = '';
  if (templateId) {
    const template = await db.get("SELECT * FROM Templates WHERE id = ?", templateId);
    if (template) {
      referenceUrl = template.url; 
      try {
        const imgUrl = template.thumbnail_url || template.url;
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
           const buffer = await imgRes.arrayBuffer();
           referenceImagePart = {
             inlineData: {
               data: Buffer.from(buffer).toString('base64'),
               mimeType: imgRes.headers.get('content-type') || 'image/jpeg'
             }
           };
        }
      } catch (e) {
        console.error("Failed to fetch reference template image", e);
      }
    }
  }

  // Construct Prompt based on Type
  let prompt = `Role: You are an expert minimalist graphic designer. 
  Task: Create a visual design for a business named "${name}".
  Industry: ${industry || 'General'}.
  Description: ${description || 'A modern business'}.
  Style: ${visualStyle || 'Modern'}.
  Colors: ${customColorPalette || 'Professional color scheme'}.
  
  IMPORTANT: You must return ONLY valid SVG code. No markdown code blocks (like \`\`\`svg), no conversational text, no explanations. Just the raw <svg>...</svg> string.
  `;
  
  if (type === 'logo') {
    prompt += "Output: A professional, scalable, minimalist logo in SVG format. Ensure all text uses sans-serif fonts and is centered. Use distinct shapes and high contrast.";
  } else if (type === 'web') {
    // Changing 'web' to generate a wireframe SVG instead of HTML code, so it can be displayed immediately
    prompt += "Output: A flat, high-fidelity UI wireframe/mockup of a landing page website homepage in SVG format. Dimensions: 800x600. Include a header, a hero section with a placeholder image and headline, a services section with 3 icons, and a footer. Use rectangles and text elements to simulate the website layout.";
  } else if (type === 'social') {
    prompt += "Output: A square social media post (1080x1080 viewbox) in SVG format. It should be an promotional banner with a catchy headline, the business name, and abstract geometric decorations.";
  } else if (type === 'brochure') {
    prompt += "Output: A layout for a brochure cover (A4 ratio) in SVG format. Include the title, placeholder imagery using shapes, and an elegant layout.";
  } else {
    prompt += "Output: A conceptual design in SVG format.";
  }

  if (referenceImagePart) {
    prompt += " I have attached a reference image. Analyze its style, color balance, and composition. Create a unique design that is INSPIRED by this reference but NOT a direct copy.";
  }

  const parts = [];
  if (referenceImagePart) parts.push(referenceImagePart);
  parts.push({ text: prompt });

  const modelName = 'gemini-2.5-flash'; 
  
  console.log(`Generating ${type} for ${name}...`);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
    });

    let generatedText = response.text || "";
    
    // Robust Extraction Logic
    let imageUrl = '';
    
    // 1. Try to find SVG block
    const svgMatch = generatedText.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      imageUrl = `data:image/svg+xml;base64,${Buffer.from(svgMatch[0]).toString('base64')}`;
    } else {
        // Fallback: Create an SVG containing the text if no SVG was found
        const cleanText = generatedText.replace(/<[^>]*>?/gm, '').substring(0, 200).replace(/"/g, "'");
        const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background-color:#111">
            <rect width="100%" height="100%" fill="#111"/>
            <text x="50%" y="50%" fill="#7bc143" font-family="sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle">
                ${cleanText || 'Design generated but format was invalid.'}
            </text>
        </svg>`;
        imageUrl = `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`;
        console.warn("No SVG found in response, using fallback text display.");
    }

    // Database Logging
    let designTaskId = null;
    if (type === 'web') {
       // For web, we save the task but now we also return the generated wireframe immediately
       const result = await db.run(
         "INSERT INTO DesignTasks (lead_id, type, status, request_details, reference_template_id, output_url) VALUES (?, ?, ?, ?, ?, ?)",
         data.contactId || null, 'web', 'completed', businessData, templateId || null, imageUrl
       );
       designTaskId = result.lastID;
    } else if (data.contactId) {
       await db.run(
         "INSERT INTO DesignTasks (lead_id, type, status, request_details, reference_template_id, output_url) VALUES (?, ?, ?, ?, ?, ?)",
         data.contactId, type, 'completed', businessData, templateId || null, imageUrl
       );
    }

    return {
      id: designTaskId ? designTaskId.toString() : Date.now().toString(),
      status: 'ready', // Always return ready since we now generate SVG mockups for everything
      imageUrl,
      type,
      data: data,
      templateId,
      templateLink: referenceUrl,
      designTaskId
    };

  } catch (err) {
    console.error("Gemini API Error:", err);
    throw new Error("AI Generation Service Failed: " + err.message);
  }
}

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

// 1. Leads & Contact
app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, design_interest } = req.body;
  if (!name || !email) return res.status(400).json({ error: "Name and Email required" });

  try {
    const result = await db.run(
      "INSERT INTO Leads (name, company, email, phone, design_interest) VALUES (?, ?, ?, ?, ?)",
      name, company, email, phone, design_interest
    );
    res.status(201).json({ message: "Lead saved", id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get("SELECT * FROM Users WHERE username = ?", username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Auth failed" });
  }
});

// 3. Leads Management
app.get('/api/leads', authenticateToken, requireRole(['admin', 'coordinator', 'designer']), async (req, res) => {
  try {
    const leads = await db.all("SELECT * FROM Leads ORDER BY created_at DESC");
    res.json(leads);
  } catch (err) { res.status(500).json({ error: "Failed to fetch leads" }); }
});

app.put('/api/leads/:id', authenticateToken, requireRole(['admin', 'coordinator']), async (req, res) => {
  const { status, notes } = req.body;
  try {
    await db.run("UPDATE Leads SET status = ?, notes = ? WHERE id = ?", status, notes, req.params.id);
    res.json({ message: "Lead updated" });
  } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

app.delete('/api/leads/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await db.run("DELETE FROM Leads WHERE id = ?", req.params.id);
    res.json({ message: "Lead deleted" });
  } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

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
  } catch (err) { res.status(500).json({ error: "Export failed" }); }
});

// 4. Templates Management
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await db.all("SELECT * FROM Templates ORDER BY created_at DESC");
    res.json(templates);
  } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

app.post('/api/templates', authenticateToken, requireRole(['admin', 'designer']), async (req, res) => {
  const { title, category, url, thumbnail_url } = req.body;
  try {
    await db.run(
      "INSERT INTO Templates (title, category, url, thumbnail_url, created_by) VALUES (?, ?, ?, ?, ?)",
      title, category, url, thumbnail_url, req.user.id
    );
    res.status(201).json({ message: "Template added" });
  } catch (err) { res.status(500).json({ error: "Add failed" }); }
});

app.delete('/api/templates/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await db.run("DELETE FROM Templates WHERE id = ?", req.params.id);
    res.json({ message: "Template deleted" });
  } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

// 5. Task Management
app.get('/api/tasks', authenticateToken, requireRole(['admin', 'coordinator', 'designer']), async (req, res) => {
  try {
    const tasks = await db.all(`
      SELECT dt.*, l.name as lead_name, l.company as lead_company, u.username as assignee_name 
      FROM DesignTasks dt 
      LEFT JOIN Leads l ON dt.lead_id = l.id
      LEFT JOIN Users u ON dt.assigned_to = u.id
      ORDER BY dt.created_at DESC
    `);
    res.json(tasks);
  } catch (err) { res.status(500).json({ error: "Fetch tasks failed" }); }
});

app.put('/api/tasks/:id', authenticateToken, requireRole(['admin', 'coordinator', 'designer']), async (req, res) => {
  const { status, assigned_to, output_url } = req.body;
  try {
    // Build query dynamically
    let query = "UPDATE DesignTasks SET ";
    const params = [];
    if (status) { query += "status = ?, "; params.push(status); }
    if (assigned_to) { query += "assigned_to = ?, "; params.push(assigned_to); }
    if (output_url) { query += "output_url = ?, "; params.push(output_url); }
    
    query = query.slice(0, -2); // remove last comma
    query += " WHERE id = ?";
    params.push(req.params.id);
    
    await db.run(query, ...params);
    res.json({ message: "Task updated" });
  } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// New Route: Create a Design Task (For Web or manual requests)
// Used by geminiService when type === 'web'
app.post('/api/design-tasks', upload.any(), async (req, res) => {
  try {
    const { type, businessData } = req.body;
    const result = await handleAIGeneration(type, businessData, req.files, db);
    res.json(result);
  } catch (err) {
    console.error("Design Task Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// New Route: Get Design Status for Polling
app.get('/api/generated-designs/:id/status', async (req, res) => {
  const { id } = req.params;
  try {
    const task = await db.get("SELECT * FROM DesignTasks WHERE id = ?", id);
    
    if (task) {
       let imageUrl = '';
       let status = 'initial_draft_placeholder';

       if (task.status === 'completed' && task.output_url) {
         status = 'ready';
         imageUrl = task.output_url;
       } else if (task.status === 'in_progress') {
         status = 'generating_by_designer';
         imageUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjIyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM3YmMxNDMiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EZXNpZ25lciBpcyB3b3JraW5nIG9uIGl0Li4uPC90ZXh0Pjwvc3ZnPg==";
       } else {
         imageUrl = task.output_url || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTExIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM3YmMxNDMiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5XZWJzaXRlIE1vY2t1cCBHZW5lcmF0ZWQ8L3RleHQ+PC9zdmc+";
       }
       
       return res.json({ imageUrl, status });
    }
    
    res.status(404).json({ error: "Design not found" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Status check failed" });
  }
});


// 6. Users (Admin Only)
app.get('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await db.all("SELECT id, username, role, created_at FROM Users");
    res.json(users);
  } catch (err) { res.status(500).json({ error: "Fetch users failed" }); }
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
  } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

app.post('/api/generate-design', upload.any(), async (req, res) => {
  try {
    const { type, businessData } = req.body;
    const files = req.files; // Array of files if any

    const result = await handleAIGeneration(type, businessData, files, db);
    res.json(result);
  } catch (err) {
    console.error("Generation Error:", err);
    res.status(500).json({ error: err.message || "Generation failed" });
  }
});

// Admin endpoint to manually trigger generation for a task (e.g. detailed web gen)
app.post('/api/admin/design-tasks/:id/generate', authenticateToken, requireRole(['admin', 'designer']), async (req, res) => {
    // Logic to regenerate or process a task
    // For now, return mock success
    res.json({ status: 'success', message: 'Task processing started' });
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