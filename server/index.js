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

// Multer Setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- Database Setup ---
const PERSISTENT_DATA_DIR = process.env.RENDER_DISK_PATH || path.join(__dirname, '..', 'data');
if (!fs.existsSync(PERSISTENT_DATA_DIR)) {
  fs.mkdirSync(PERSISTENT_DATA_DIR, { recursive: true });
}
const dbPath = path.join(PERSISTENT_DATA_DIR, 'crm.sqlite');

let db;

async function initializeDatabase() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL, 
      password TEXT NOT NULL, 
      role TEXT NOT NULL CHECK(role IN ('admin', 'designer', 'coordinator')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS DesignTasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending', 
      assigned_to INTEGER, 
      reference_template_id INTEGER,
      output_url TEXT,
      request_details TEXT, 
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lead_id) REFERENCES Leads(id),
      FOREIGN KEY(assigned_to) REFERENCES Users(id)
    );
  `);

  const userCount = await db.get("SELECT COUNT(*) as count FROM Users");
  if (userCount.count === 0) {
    await db.run("INSERT INTO Users (username, password, role) VALUES (?, ?, ?)", 'admin@getdesign.cloud', 'admin123', 'admin');
  }
}

initializeDatabase().catch(err => {
  console.error("DB Init Failed:", err);
});

// --- Helper: AI Generation Logic ---
async function handleAIGeneration(type, businessData, files, db) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });
  
  // Parse Business Data
  const data = JSON.parse(businessData);
  const { name, industry, description, visualStyle, customColorPalette, logoStyle, socialPlatform, brochureSize, brochureOrientation, brochurePageCount } = data;

  // SYSTEM INSTRUCTION: HIGH-END AGENCY PERSONA
  const systemInstruction = `You are a Senior Art Director at a world-class digital agency (like Pentagram, Landor, or Frog). 
  Your task is to write high-fidelity SVG code that rivals premium paid templates from Envato Elements, Freepik Premium, and Dribbble top shots.
  
  CRITICAL OUTPUT RULES:
  1. **FORMAT**: Output ONLY valid, standalone SVG code. NO markdown blocks (\`\`\`svg), NO conversational text. Start with <svg and end with </svg>.
  2. **QUALITY**: The design must be "Pixel Perfect". Use gradients (<linearGradient>, <radialGradient>), drop shadows (<filter>), and clipping paths (<clipPath>) to create depth, shine, and texture.
  3. **TYPOGRAPHY**: Use standard fonts (Arial, Helvetica, Verdana) but style them with expert tracking, weight, and hierarchy. Center and align text perfectly.
  4. **COLOR**: Use sophisticated, high-contrast palettes. 
     - Tech: Deep Blues/Purples with Neon Accents.
     - Corporate: Trusted Navy/Greys with White space.
     - Creative: Vibrant, bold combinations.
  5. **NO PLACEHOLDERS**: Do not write "Image Here". Create an abstract geometric composition or a stylized illustration to represent images.
  `;

  // Dynamic Prompt Construction based on inputs
  let prompt = `CLIENT BRIEF:
  - Business Name: "${name}"
  - Industry: ${industry || 'Modern Technology & SaaS'}
  - Vibe/Description: ${description || 'Premium, trusted, and innovative'}
  - Visual Style: ${visualStyle || 'Minimalist & Luxury'}
  - Colors: ${customColorPalette || 'Agency Grade Premium Palette (e.g., Midnight Blue + Cyber Green, or Matte Black + Gold)'}
  
  TASK:
  `;

  if (type === 'logo') {
    prompt += `
    Create a Masterpiece Logo (${logoStyle || '3d'} Style).
    Dimensions: 800x600.
    
    Requirements:
    - If '3d': Use multiple gradient layers to create a volumetric, glossy icon. It should look like a polished 3D render.
    - If 'flat': Use golden ratio geometry. Clean, bold, negative space.
    - Composition: Icon on the left or top, carefully typeset Business Name with tracked-out spacing.
    - Background: Use a subtle dark or light gradient background (depending on style) to make the logo pop.
    `;
  } else if (type === 'web') {
    prompt += `
    Create a High-Fidelity Website Homepage UI Mockup (Desktop View).
    Dimensions: 1440x960.
    Style Reference: Award-winning Awwwards Site or Top Envato Tech Theme.
    
    Layout Structure (Must include all):
    1. **Navbar**: Glassmorphism effect background. Logo on left, modern pill-shaped 'Get Started' button on right. Links: Home, Features, Pricing.
    2. **Hero Section**:
       - Left: Big, Bold H1 Headline (e.g., "Revolutionize Your ${industry}").
       - Subtext: Clean grey paragraph.
       - Buttons: Primary Gradient Button + Secondary Outline Button.
       - Right: A complex Abstract 3D Illustration or Dashboard Mockup (use geometric shapes, charts, floating elements with drop shadows).
    3. **Stats/Logos Bar**: A strip below hero showing "Trusted by" dummy logos (simple shapes).
    4. **Feature Cards**: A row of 3 cards with soft shadows, icons, and text.
    
    Visuals:
    - Use a sophisticated dark mode or clean light mode theme.
    - Add subtle background patterns (dots, grid, or soft mesh gradients) to avoid empty space.
    `;
  } else if (type === 'social') {
    prompt += `
    Create a Premium Social Media Post for ${socialPlatform || 'Instagram'}.
    Dimensions: ${socialPlatform === 'facebook' ? '1200x630' : socialPlatform === 'linkedin' ? '1584x396' : '1080x1080'}.
    
    Style: Freepik Premium Business Sale / Promo Template.
    Content: "${data.postContent || `Welcome to ${name}`}".
    
    Requirements:
    - Use diagonal or curved layout dividers.
    - Create a "Photo Placeholder" area using a stylish gradient or abstract pattern.
    - Strong Typography: Big Bold Headline.
    - Call to Action Button: "Learn More" or "Shop Now".
    - Decorative elements: Floating circles, dots, or lines to add energy.
    `;
  } else if (type === 'brochure') {
    prompt += `
    Create a Corporate Brochure Cover Layout (${brochureSize || 'A4'}, ${brochureOrientation || 'Portrait'}).
    Dimensions: ${brochureOrientation === 'landscape' ? '842x595' : '595x842'}.
    
    Style: Minimalist Swiss Grid Design.
    Requirements:
    - Large, elegant serif or sans-serif typography for the title "${name}".
    - Use a large abstract shape or image mask as the focal point.
    - Clean footer with dummy contact info (Phone, Website).
    - Use a distinct vertical or horizontal grid layout.
    `;
  }

  const parts = [{ text: prompt }];
  const modelName = 'gemini-2.5-flash'; 

  console.log(`Generating premium ${type} for ${name} [Style: ${visualStyle}]...`);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.65, // Slightly lower for precision
      },
      contents: { parts },
    });

    let generatedText = response.text || "";
    let imageUrl = '';
    
    // Robust SVG Extraction: Look for the first <svg> tag and the last </svg> tag
    const startIndex = generatedText.indexOf('<svg');
    const endIndex = generatedText.lastIndexOf('</svg>');

    if (startIndex !== -1 && endIndex !== -1) {
      const svgContent = generatedText.substring(startIndex, endIndex + 6);
      imageUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    } else {
      // Emergency Fallback with error message in SVG
      console.warn("AI did not return valid SVG. Using fallback.");
      const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="100%" height="100%" fill="#111"/><text x="50%" y="50%" fill="#7bc143" font-family="Arial" font-size="20" text-anchor="middle">Design Generation Incomplete. Please Try Again.</text></svg>`;
      imageUrl = `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`;
    }

    // Save Task for Admin
    let designTaskId = null;
    if (data.contactId) {
       const result = await db.run(
         "INSERT INTO DesignTasks (lead_id, type, status, request_details, output_url) VALUES (?, ?, ?, ?, ?)",
         data.contactId, type, 'completed', businessData, imageUrl
       );
       designTaskId = result.lastID;
    }

    return {
      id: designTaskId ? designTaskId.toString() : Date.now().toString(),
      status: 'ready',
      imageUrl,
      type,
      data: data,
      designTaskId
    };

  } catch (err) {
    console.error("Gemini API Error:", err);
    throw new Error("AI Design Generation Failed");
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

// --- Routes ---
app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, design_interest } = req.body;
  try {
    const result = await db.run(
      "INSERT INTO Leads (name, company, email, phone, design_interest) VALUES (?, ?, ?, ?, ?)",
      name, company, email, phone, design_interest
    );
    res.status(201).json({ message: "Lead saved", id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error saving contact" });
  }
});

app.post('/api/generate-design', upload.any(), async (req, res) => {
  try {
    const { type, businessData } = req.body;
    const result = await handleAIGeneration(type, businessData, req.files, db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get("SELECT * FROM Users WHERE username = ?", username);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token, role: user.role });
});

app.get('/api/leads', authenticateToken, async (req, res) => {
  const leads = await db.all("SELECT * FROM Leads ORDER BY created_at DESC");
  res.json(leads);
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  const tasks = await db.all("SELECT * FROM DesignTasks ORDER BY created_at DESC");
  res.json(tasks);
});

app.get('/api/templates', async (req, res) => {
  res.json([]);
});

// Serve Frontend
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});