// server/index.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai'; // Added Type import
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import nodemailer from 'nodemailer';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
// Removed: import fetch from 'node-fetch'; // Use native fetch now

// Load environment variables from .env file (for local development)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
let db;

async function initializeDatabase() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      design_interest TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS GeneratedDesigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER,
      design_type TEXT NOT NULL,
      business_name TEXT,
      industry TEXT,
      description TEXT,
      image_url TEXT NOT NULL,
      template_link TEXT,
      conceptual_template_id TEXT, -- New column to store conceptual template ID
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES Leads(id)
    );

    CREATE TABLE IF NOT EXISTS ConceptualTemplates (
      id TEXT PRIMARY KEY, -- e.g., 'logo-L1-minimalist-tech'
      type TEXT NOT NULL,
      visual_style TEXT NOT NULL,
      industry_keywords TEXT, -- Stored as JSON string: ['tech', 'software']
      prompt_hint TEXT NOT NULL,
      thumbnail_url TEXT, -- Direct URL from Google Drive
      generated_content_examples TEXT -- Stored as JSON string: { headline, body, cta }
    );
  `);
  console.log('Database initialized.');

  // Insert initial templates if the table is empty
  const templateCount = await db.get("SELECT COUNT(*) as count FROM ConceptualTemplates");
  if (templateCount.count === 0) {
    await insertInitialTemplates();
  }
}

// Initial templates to seed the database
async function insertInitialTemplates() {
  const initialTemplates = [
    // --- LOGO Templates ---
    {
      id: 'logo-L1-minimalist-tech',
      type: 'logo',
      visual_style: 'minimalist',
      industry_keywords: JSON.stringify(['tech', 'technology', 'software', 'startup', 'digital', 'innovation', 'IT', 'AI', 'data']),
      prompt_hint: 'Design a clean, abstract, geometric logo for a tech company. Focus on a simple, memorable icon, modern typography, and a fresh color palette. Minimalist layout with ample negative space.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR LOGO TEMPLATE L1 HERE
      generated_content_examples: JSON.stringify({ headline: 'TechFlow Innovations', body: 'Streamlining Tomorrow, Today', cta: 'Explore Solutions' })
    },
    {
      id: 'logo-L2-bold-gaming',
      type: 'logo',
      visual_style: 'bold',
      industry_keywords: JSON.stringify(['gaming', 'esports', 'entertainment', 'interactive', 'virtual reality']),
      prompt_hint: 'Create a bold, dynamic logo with an edgy mascot or icon for a gaming company. Use strong contrasts, energetic colors, and modern, aggressive typography. Emphasize speed, competition, and immersive experiences.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR LOGO TEMPLATE L2 HERE
      generated_content_examples: JSON.stringify({ headline: 'Pixel Vanguard', body: 'Conquer Every Realm', cta: 'Join Now' })
    },
    // --- BRAND IDENTITY Templates ---
    {
      id: 'identity-BI1-elegant-luxury',
      type: 'identity',
      visual_style: 'elegant',
      industry_keywords: JSON.stringify(['luxury', 'fashion', 'jewelry', 'boutique', 'high-end', 'premium']),
      prompt_hint: 'Render an elegant and sophisticated brand identity kit flat-lay. Feature a refined logomark, classic serif typography, and a subdued color palette with metallic accents. Include items like embossed business cards, letterhead, and product packaging, highlighting quality and exclusivity.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR BRAND IDENTITY TEMPLATE BI1 HERE
      generated_content_examples: JSON.stringify({ headline: 'Eclat Couture', body: 'Redefining Opulence', cta: 'Discover Our Collection' })
    },
    {
      id: 'identity-BI2-playful-children',
      type: 'identity',
      visual_style: 'playful',
      industry_keywords: JSON.stringify(['children', 'kids', 'toys', 'education', 'play', 'family']),
      prompt_hint: 'Design a whimsical and colorful brand identity kit flat-lay for a children\'s brand. Use a cheerful logotype with rounded letters, playful illustrations, and a bright color scheme. Items include fun business cards, stickers, and product tags, emphasizing joy and creativity.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR BRAND IDENTITY TEMPLATE BI2 HERE
      generated_content_examples: JSON.stringify({ headline: 'Curio Kids Club', body: 'Where Imagination Takes Flight', cta: 'Explore & Play' })
    },
    // --- SOCIAL MEDIA Templates ---
    {
      id: 'social-SM1-minimalist-business',
      type: 'social',
      visual_style: 'minimalist',
      industry_keywords: JSON.stringify(['corporate', 'business', 'consulting', 'finance', 'professional services']),
      prompt_hint: 'Create a clean, minimalist social media post template for a professional business. Use a neutral color palette with one accent color, clear sans-serif typography, and subtle geometric elements. Focus on a clear message with minimal clutter.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR SOCIAL MEDIA TEMPLATE SM1 HERE
      generated_content_examples: JSON.stringify({ headline: 'Elevate Your Strategy', body: 'Expert Insights for Growth', cta: 'Read Our Whitepaper' })
    },
    {
      id: 'social-SM2-bold-fitness',
      type: 'social',
      visual_style: 'bold',
      industry_keywords: JSON.stringify(['fitness', 'gym', 'health', 'wellness', 'sports', 'training']),
      prompt_hint: 'Design a bold, high-energy social media post template for a fitness brand. Use strong action imagery, vibrant colors, and impactful, distressed typography. Emphasize strength, motivation, and results.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR SOCIAL MEDIA TEMPLATE SM2 HERE
      generated_content_examples: JSON.stringify({ headline: 'Unleash Your Power', body: 'Transform Your Body, Mind, and Spirit', cta: 'Start Your Journey' })
    },
    // --- BROCHURE/CATALOG Templates ---
    // Brochure-Catalog-Landscape
    {
      id: 'brochure-BL1-futuristic-tech',
      type: 'brochure',
      visual_style: 'futuristic',
      industry_keywords: JSON.stringify(['tech', 'software', 'AI', 'robotics', 'innovation', 'future']),
      prompt_hint: 'Design a multi-page landscape brochure with a futuristic and sleek aesthetic. Incorporate glowing lines, abstract geometric patterns, and a dark theme. Use modern sans-serif fonts and clean data visualization elements. Emphasize innovation and advanced technology.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR BROCHURE LANDSCAPE TEMPLATE BL1 HERE
      generated_content_examples: JSON.stringify({ headline: 'Pioneering Tomorrow\'s Solutions', body: 'Our advanced technological platforms are engineered to deliver unparalleled efficiency, driving your enterprise into a new era of digital excellence and innovation.', cta: 'Request a Live Demo' })
    },
    {
      id: 'brochure-BL2-elegant-travel',
      type: 'brochure',
      visual_style: 'elegant',
      industry_keywords: JSON.stringify(['travel', 'tourism', 'luxury resort', 'vacation', 'hospitality', 'destinations']),
      prompt_hint: 'Create an elegant landscape brochure for a luxury travel agency. Feature stunning photography of exotic destinations, sophisticated serif typography, and a spacious layout. Use a serene color palette with hints of gold, conveying relaxation and exclusivity.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR BROCHURE LANDSCAPE TEMPLATE BL2 HERE
      generated_content_examples: JSON.stringify({ headline: 'Your Journey, Reimagined', body: 'Indulge in bespoke travel experiences meticulously crafted to inspire, enchant, and create indelible memories across the globe.', cta: 'Book Your Escape' })
    },
    // Brochure-Catalog-Portrait
    {
      id: 'brochure-BP1-minimalist-corporate',
      type: 'brochure',
      visual_style: 'minimalist',
      industry_keywords: JSON.stringify(['corporate', 'consulting', 'business', 'finance', 'legal']),
      prompt_hint: 'Design a clean, minimalist portrait brochure for a corporate consulting firm. Use a professional blue/grey color scheme, crisp sans-serif typography, and a structured layout with clear sections. Focus on conveying professionalism and clarity.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR BROCHURE PORTRAIT TEMPLATE BP1 HERE
      generated_content_examples: JSON.stringify({ headline: 'Strategic Partnership for Success', body: 'We provide tailored consulting services designed to optimize your operations, enhance market position, and drive sustainable business growth.', cta: 'Schedule a Consultation' })
    },
    {
      id: 'brochure-BP2-playful-education',
      type: 'brochure',
      visual_style: 'playful',
      industry_keywords: JSON.stringify(['education', 'school', 'university', 'learning', 'kids', 'youth']),
      prompt_hint: 'Create a vibrant, playful portrait brochure for an educational institution. Use a bright, inviting color palette, engaging illustrations, and fun, readable typography. Design for a young audience, emphasizing discovery and interactive learning.',
      thumbnailUrl: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR BROCHURE PORTRAIT TEMPLATE BP2 HERE
      generated_content_examples: JSON.stringify({ headline: 'Ignite a Passion for Learning', body: 'Our innovative programs and dedicated educators foster a dynamic environment where students thrive, explore, and achieve their fullest potential.', cta: 'Enroll Today' })
    },
    // Tri-Fold Flyer
    {
      id: 'brochure-TF1-bold-marketing',
      type: 'brochure',
      visual_style: 'bold',
      industry_keywords: JSON.stringify(['marketing', 'advertising', 'agency', 'promotion', 'sales']),
      prompt_hint: 'Design a bold and impactful tri-fold flyer for a marketing agency. Use strong visuals, contrasting colors, and energetic typography to grab attention. Structure clearly defined sections for services, benefits, and contact information.',
      thumbnailUrl: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR TRI-FOLD FLYER TEMPLATE TF1 HERE
      generated_content_examples: JSON.stringify({ headline: 'Supercharge Your Brand', body: 'Unlock unparalleled visibility and engagement with our innovative marketing strategies, designed to connect you with your audience and drive measurable results.', cta: 'Get Your Free Audit' })
    },
    // --- WEB DESIGN Templates ---
    {
      id: 'web-W1-futuristic-software',
      type: 'web',
      visual_style: 'futuristic',
      industry_keywords: JSON.stringify(['software', 'cloud', 'AI', 'SaaS', 'platform', 'startup', 'web development']),
      prompt_hint: 'Design a responsive website layout with a futuristic, dark mode aesthetic. Incorporate glowing UI elements, abstract backgrounds, and modern sans-serif typography. Focus on clean data presentation, intuitive navigation, and engaging hero sections for a software product.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR WEB DESIGN TEMPLATE W1 HERE
      generated_content_examples: JSON.stringify({ headline: 'Next-Gen AI Platform', body: 'Empower your business with intelligent automation and data-driven insights, seamlessly integrated into your workflow for unprecedented efficiency.', cta: 'Start Free Trial' })
    },
    {
      id: 'web-W2-elegant-photography',
      type: 'web',
      visual_style: 'elegant',
      industry_keywords: JSON.stringify(['photography', 'art', 'portfolio', 'creative', 'gallery', 'artist']),
      prompt_hint: 'Create an elegant and minimalist website layout for a professional photography portfolio. Emphasize large, high-quality image displays, subtle hover effects, and sophisticated serif typography. Use a clean, monochromatic color scheme to let the visuals speak. Showcase work with grace and impact.',
      thumbnail_url: '', // PASTE YOUR DIRECT GOOGLE DRIVE URL FOR WEB DESIGN TEMPLATE W2 HERE
      generated_content_examples: JSON.stringify({ headline: 'Capturing Moments, Creating Art', body: 'Discover a curated collection of evocative imagery, each frame a testament to the beauty and emotion found in every moment.', cta: 'View Portfolio' })
    },
  ];

  for (const template of initialTemplates) {
    try {
      await db.run(
        `INSERT INTO ConceptualTemplates (id, type, visual_style, industry_keywords, prompt_hint, thumbnail_url, generated_content_examples) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        template.id, template.type, template.visual_style, template.industry_keywords, 
        template.prompt_hint, template.thumbnail_url, template.generated_content_examples
      );
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        console.log(`Template with ID ${template.id} already exists, skipping.`);
      } else {
        console.error(`Error inserting template ${template.id}:`, error);
      }
    }
  }
  console.log('Initial templates seeded.');
}


initializeDatabase().catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVICE_HOST,
  port: parseInt(process.env.EMAIL_SERVICE_PORT || '587'),
  secure: parseInt(process.env.EMAIL_SERVICE_PORT || '587') === 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_AUTH_USER,
    pass: process.env.EMAIL_AUTH_PASS,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("Nodemailer configuration error:", error);
  } else {
    console.log("Nodemailer is ready to send emails.");
  }
});


// Multer setup for file uploads (zip files)
const upload = multer({
  dest: os.tmpdir(), // Use OS temporary directory
  limits: {
    fileSize: (parseInt(process.env.ZIP_MAX_SIZE_MB || '10') * 1024 * 1024), // Max 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip') {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed!'), false);
    }
  },
});

// Middleware
app.use(express.json({ limit: '50mb' })); // Allow larger JSON bodies for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS setup (adjust for your frontend's domain in production)
app.use((req, res, next) => {
  // In production on Hostinger, use your domain: 'https://www.yourdomain.com'
  res.header('Access-Control-Allow-Origin', '*'); 
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE'); // Added PUT, DELETE
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Gemini API Initialization (on the server)
const GEMINI_API_KEY = process.env.API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Server Error: GEMINI_API_KEY is not configured in environment variables.");
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Re-using error handling logic from frontend for server-side
function handleGeminiError(error) {
  const msg = (error.message || error.toString()).toLowerCase();
  console.error("Server Gemini API Error Details:", error);

  if (msg.includes("referer") && msg.includes("blocked")) {
    return "API Key Referrer Restriction: Your API key is restricted to specific domains. Please check your Google Cloud Console.";
  }
  
  if (msg.includes("401") || msg.includes("403") || msg.includes("key") || msg.includes("unauthorized") || msg.includes("permission_denied")) {
    return "API Key configuration error. Please check your API key setup and permissions on the server.";
  }
  
  if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")) {
    return "Usage Limit Exceeded: The AI service quota has been reached. Please wait a moment and try again.";
  }

  if (msg.includes("500") || msg.includes("internal") || msg.includes("overloaded")) {
    return "Service Error: Google AI is currently experiencing high traffic. Please retry in a moment.";
  }
  
  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("policy")) {
    return "Content Filtered: The request was blocked by safety settings. Please modify your business description.";
  }

  if (msg.includes("fetch failed") || msg.includes("network")) {
    return "Network Error: Server failed to connect to AI service. Please check server's internet connection.";
  }

  return error.message || "An unexpected error occurred during generation on the server.";
}

// Helper to extract mimeType and data from a data URL
function parseDataUrl(dataUrl) {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], data: matches[2] };
  }
  return null;
}


// --- Template Selection Function (Queries DB) ---
async function selectTemplate(designType, industry, visualStyle) {
  const allTemplates = await db.all("SELECT * FROM ConceptualTemplates");

  let candidates = allTemplates.filter(t => t.type === designType);

  candidates = candidates.map(template => {
    let score = 0;
    const industryLower = industry ? industry.toLowerCase() : '';
    const templateIndustryKeywords = JSON.parse(template.industry_keywords || '[]');

    // Industry match: higher score if exact or keyword match
    if (industryLower) {
      if (templateIndustryKeywords.some(keyword => industryLower.includes(keyword))) {
        score += 3; 
      }
    } else {
      score += 1; // General template is a minor match if no industry is provided
    }
    
    // Visual style match: highest score for direct match
    if (visualStyle && template.visual_style === visualStyle) {
      score += 5; 
    } else if (!visualStyle) {
      score += 1; // Minor match if no style is provided
    }

    // Prioritize templates with a thumbnail image
    if (template.thumbnail_url && template.thumbnail_url.trim() !== '') {
      score += 2; // Templates with visual reference are preferred
    }

    return { ...template, score };
  });

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score > 0) {
    console.log(`Selected template: ${candidates[0].id} with score ${candidates[0].score}`);
    return candidates[0];
  }

  // Fallback: If no good match, find a general one of the type
  const fallback = allTemplates.find(t => t.type === designType);
  if (fallback) {
    console.log(`Falling back to default template for type: ${fallback.id}`);
    return fallback;
  }

  console.log(`No template found for type: ${designType}`);
  return null;
}


// --- API Endpoints ---

// Endpoint to save contact info (lead generation)
app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, design_interest } = req.body;

  if (!name || !company || !email || !phone) {
    return res.status(400).json({ error: "Missing required contact fields." });
  }

  try {
    const result = await db.run(
      "INSERT INTO Leads (name, company, email, phone, design_interest) VALUES (?, ?, ?, ?, ?)",
      name, company, email, phone, design_interest
    );
    res.status(201).json({ id: result.lastID, message: "Contact saved successfully." });
  } catch (err) {
    console.error("Database error saving contact:", err);
    if (err.message.includes("UNIQUE constraint failed: Leads.email")) {
      // If email already exists, retrieve existing ID
      try {
        const existingLead = await db.get("SELECT id FROM Leads WHERE email = ?", email);
        if (existingLead) {
          return res.status(200).json({ id: existingLead.id, message: "Contact already exists, using existing ID." });
        }
      } catch (e) {
        console.error("Error retrieving existing lead:", e);
      }
    }
    res.status(500).json({ error: "Failed to save contact information." });
  }
});

// API Endpoint for design generation
app.post('/api/generate-design', upload.single('zipFile'), async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Server API Key not configured. Please contact support." });
  }

  let { type, businessData, logoBase64, brochureBase64 } = req.body;
  
  // businessData comes as string from FormData, parse it
  if (typeof businessData === 'string') {
    businessData = JSON.parse(businessData);
  }

  let descriptionFromZip = ''; // To store description extracted from zip
  let logoFromZip = ''; // To store logo extracted from zip
  let brochureFromZip = ''; // To store brochure extracted from zip

  const tempDir = path.join(os.tmpdir(), `upload-${Date.now()}`); // Temp dir for zip extraction

  try {
    if (req.file) { // If a zip file was uploaded
      console.log('Zip file received:', req.file.originalname);
      await promisify(fs.mkdir)(tempDir, { recursive: true }); // Create temp dir

      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(tempDir, true);
      console.log('Zip extracted to:', tempDir);

      const files = await promisify(fs.readdir)(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const ext = path.extname(file).toLowerCase();
        const fileName = path.basename(file).toLowerCase();

        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          if (fileName.includes('logo') && !logoFromZip) {
            logoFromZip = `data:image/${ext.substring(1)};base64,${fileBase64}`;
          } else if (fileName.includes('brochure') && !brochureFromZip) {
            brochureFromZip = `data:image/${ext.substring(1)};base64,${fileBase64}`;
          }
          // If no specific name, just take the first image found as a generic asset
          if (!logoFromZip && !brochureFromZip) {
            logoFromZip = `data:image/${ext.substring(1)};base64,${fileBase64}`; // Fallback: use first image as logo
          }
        } else if (['.txt', '.md'].includes(ext)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          if (fileName.includes('description') || fileName.includes('brief')) {
            descriptionFromZip += fileContent + '\n';
          }
        } else if (['.pdf'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          if (fileName.includes('brochure')) {
            brochureFromZip = `data:application/pdf;base64,${fileBase64}`;
          }
        } else if (['.docx'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          // Note: Mammoth requires a buffer, not base64 string directly for initial processing.
          // For consistency with data URLs, we'll store as base64 and parse on use.
          if (fileName.includes('brochure')) {
            brochureFromZip = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${fileBase64}`;
          }
        }
      }
      // Prioritize zip-extracted content over form-based uploads for images
      logoBase64 = logoFromZip || logoBase64;
      brochureBase64 = brochureFromZip ? [brochureFromZip] : (brochureBase64 || null); // Treat as array from zip
      if (typeof brochureBase64 === 'string') brochureBase64 = [brochureBase64];


      // Augment or replace description
      businessData.description = descriptionFromZip || businessData.description;
      if (descriptionFromZip && !businessData.name) {
        businessData.name = req.file.originalname.replace('.zip', '') || 'Zip Project';
      }

    } else {
      console.log('No zip file uploaded, using form data.');
    }

    // --- Process brochureBase64 (can be string or string[]) ---
    const brochureTextContent = [];
    const brochureImageParts = [];

    const brochureFiles = Array.isArray(brochureBase64) ? brochureBase64 : (brochureBase64 ? [brochureBase64] : []);

    for (const dataUrl of brochureFiles) {
      const parsed = parseDataUrl(dataUrl);
      if (parsed) {
        const { mimeType, data } = parsed;
        if (mimeType.startsWith('image/')) {
          brochureImageParts.push({ inlineData: { mimeType, data } });
        } else if (mimeType === 'application/pdf') {
          try {
            const buffer = Buffer.from(data, 'base64');
            const pdfData = await pdfParse(buffer);
            brochureTextContent.push(pdfData.text);
          } catch (pdfError) {
            console.error("Error parsing PDF:", pdfError);
          }
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          try {
            const buffer = Buffer.from(data, 'base64');
            const result = await mammoth.extractRawText({ buffer: buffer });
            brochureTextContent.push(result.value);
          } catch (docxError) {
            console.error("Error parsing DOCX:", docxError);
          }
        } else {
          console.warn("Unsupported brochure file type:", mimeType);
        }
      }
    }

    // --- Template Selection & Dynamic Content Generation ---
    const selectedTemplate = await selectTemplate(type, businessData.industry, businessData.visualStyle);
    let templateGuidancePrompt = '';
    let generatedHeadline = businessData.name; // Default to business name
    let generatedBody = businessData.description; // Default to description
    let generatedCta = 'Learn More'; // Default CTA

    // Aspect ratio for image generation (default for single images)
    let aspectRatio = "1:1"; // Default to square
    if (type === 'logo') aspectRatio = "1:1";
    if (type === 'social') {
      if (businessData.socialPlatform === 'instagram') aspectRatio = "1:1";
      if (businessData.socialPlatform === 'facebook') aspectRatio = "16:9";
      if (businessData.socialPlatform === 'linkedin') aspectRatio = "4:1"; // LinkedIn banner typically wide
    }
    if (type === 'identity') aspectRatio = "4:3"; // Good for a flat-lay overview


    if (businessData.postContent) {
      generatedHeadline = businessData.postContent.split('\n')[0] || generatedHeadline;
      generatedBody = businessData.postContent.split('\n').slice(1).join(' ') || generatedBody;
      // CTA remains default or can be derived if a specific pattern is expected in postContent
    } else if (selectedTemplate) {
      // Dynamic template guidance based on whether a thumbnailUrl is available
      if (selectedTemplate.thumbnail_url && selectedTemplate.thumbnail_url.trim() !== '') {
        templateGuidancePrompt = `
          VISUAL TEMPLATE REFERENCE: An image part is provided. This image represents a template.
          Your task is to:
          1. Analyze its layout, composition, color scheme, typography, and overall aesthetic.
          2. Create a *new design* for the current business that *adopts and adapts* the core visual style of the provided template.
          3. DO NOT generate an identical copy. Evolve the style to fit the new context.
          4. Ensure the new design reflects the business name, industry, and project details provided.
          5. Replace any generic stock imagery from the template with relevant imagery for the new business.
          6. Use the provided textual content (headline, body, CTA) within the design, fitting it into the adapted template structure.
          
          The following text provides further nuance about the template's original concept: "${selectedTemplate.prompt_hint}"
        `;
      } else {
        templateGuidancePrompt = `
          DESIGN CONCEPT: Base the overall layout, composition, and visual elements on the following template description. Adapt its core aesthetics and structure to fit the new business. Replace generic elements with relevant content.
          TEMPLATE DESCRIPTION: "${selectedTemplate.prompt_hint}"
        `;
      }
      
      // If no postContent, generate content for the design
      const templateGeneratedContent = JSON.parse(selectedTemplate.generated_content_examples || '{}');

      const contentGenerationPrompt = `
        Based on the following business details and industry, and considering a template with these example content elements:
        Business Name: "${businessData.name}"
        Industry: "${businessData.industry}"
        Description: "${businessData.description}"
        
        Generate a concise, impactful marketing headline, a short body text (1-2 sentences), and a clear call-to-action (CTA).
        Use the template's example content as inspiration for tone and style, but tailor it to the current business and industry.
        Example Headline: "${templateGeneratedContent.headline || 'Inspiring Headline'}"
        Example Body: "${templateGeneratedContent.body || 'Compelling Body Text'}"
        Example CTA: "${templateGeneratedContent.cta || 'Learn More'}"

        Output ONLY in JSON format with keys "headline", "body", "cta".
        Example: {"headline": "Your Title", "body": "Your description.", "cta": "Click Here"}
      `;

      try {
        const contentAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const contentResponse = await contentAI.models.generateContent({
          model: 'gemini-2.5-flash', // Use a text-only model for content generation
          contents: [{ text: contentGenerationPrompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                body: { type: Type.STRING },
                cta: { type: Type.STRING },
              },
              propertyOrdering: ["headline", "body", "cta"],
            },
          },
        });
        const contentJson = JSON.parse(contentResponse.text);
        generatedHeadline = contentJson.headline || generatedHeadline;
        generatedBody = contentJson.body || generatedBody;
        generatedCta = contentJson.cta || generatedCta;
        console.log("Generated Content (AI):", generatedHeadline, generatedBody, generatedCta);

      } catch (contentError) {
        console.warn("Failed to generate content via AI:", contentError);
        // Fallback to template examples or generic if AI content generation fails
        generatedHeadline = templateGeneratedContent.headline || generatedHeadline;
        generatedBody = templateGeneratedContent.body || generatedBody;
        generatedCta = templateGeneratedContent.cta || generatedCta;
      }
    }


    // --- Gemini Prompt Construction ---
    const finalGeminiParts = [];

    // Add selected template's thumbnail image as visual reference IF AVAILABLE
    if (selectedTemplate && selectedTemplate.thumbnail_url && selectedTemplate.thumbnail_url.trim() !== '') {
      try {
        const imageResponse = await fetch(selectedTemplate.thumbnail_url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch template thumbnail from ${selectedTemplate.thumbnail_url}: ${imageResponse.statusText}`);
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'; // Default to jpeg if unknown
        finalGeminiParts.push({ inlineData: { mimeType: contentType, data: base64Image } });
      } catch (imgFetchError) {
        console.warn(`Could not fetch or process template thumbnail from URL: ${selectedTemplate.thumbnail_url}`, imgFetchError);
        // Continue without the thumbnail if it fails, relying on text promptHint
      }
    }


    // 1. Core textual instructions (template guidance, branding, description, content)
    let industryInstruction = `
      INDUSTRY CONTEXT: "${businessData.industry || 'General Business'}".
      VISUAL STYLE PREFERENCE: "${businessData.visualStyle || 'Adapt to the template\'s dominant style'}"
      COLOR PALETTE GUIDANCE: "${businessData.customColorPalette || 'Derive main colors from logo (if provided) or industry norms, ensuring a harmonious and professional look.'}"
      DESIGN PRINCIPLES: Ensure the design is modern, professional, visually appealing, and directly relevant to the business and chosen style.
    `;

    let specificPrompt = '';
    if (type === 'logo') {
      specificPrompt = `DESIGN TYPE: Logo. Create a standalone logo. LOGO STYLE: "${businessData.logoStyle || '3d'}".`;
    } else if (type === 'identity') {
      specificPrompt = `DESIGN TYPE: Brand Identity Flat-Lay. Create a flat-lay visual showcasing brand identity elements (e.g., business card, letterhead, envelope, mockups).`;
    } else if (type === 'social') {
      specificPrompt = `DESIGN TYPE: Social Media Post. PLATFORM: "${businessData.socialPlatform || 'Instagram'}". Focus on creating a compelling visual for online sharing.`;
    } else if (type === 'brochure') {
      specificPrompt = `DESIGN TYPE: Brochure / Catalog. FORMAT: ${businessData.brochureSize || 'A4'}, ORIENTATION: ${businessData.brochureOrientation || 'Portrait'}. Show realistic mockups.`;
    } else if (type === 'web') {
      specificPrompt = `DESIGN TYPE: Website Design. Layout for a modern, responsive website.`;
    }

    finalGeminiParts.push({
      text: `
      ${templateGuidancePrompt || ''}
      
      BRANDING INTEGRATION:
      - Business Name: "${businessData.name}" (Render legibly as per design. DO NOT add "Get Design" text to the logo or main content).
      - Description Context: "${businessData.description}".
      
      ${brochureTextContent.length > 0 ? `\nADDITIONAL CONTENT CONTEXT FROM DOCUMENTS (Extract key themes, entities, and style):\n${brochureTextContent.join('\n\n')}\n` : ''}

      TEXTUAL CONTENT TO DISPLAY IN THE DESIGN:
      - PRIMARY HEADLINE: "${generatedHeadline}"
      - BODY TEXT (concise): "${generatedBody}"
      - CALL TO ACTION (if applicable): "${generatedCta}"

      ${industryInstruction}
      ${specificPrompt}
      
      RENDER QUALITY SETTINGS (FOR VISUAL CLARITY & DIGITAL PRESENTATION):
      1. **Presentation**: Clean, sharp, and easy to understand. Optimized for digital display.
      2. **Details**: Crisp lines, clear text, precise graphics.
      3. **Lighting**: Even, soft ambient lighting to ensure all design elements are visible and legible.
      4. **Reflections**: Subtle, functional reflections only if they enhance UI clarity, not distract.
      5. **Post-Processing**: Balanced contrast and color correction for a vibrant, modern digital aesthetic.
      
      STRICT CONSTRAINT: The design must look ABSOLUTELY FINISHED, production-ready, and already EXISTS as a physical or digital product. NO sketches, NO blurry text, NO placeholder indicators.
      `
    });

    // 2. Add logo image if provided (after template image and main text)
    if (logoBase64) {
      const parsedLogo = parseDataUrl(logoBase64);
      if (parsedLogo) {
        finalGeminiParts.push({ inlineData: { mimeType: parsedLogo.mimeType, data: parsedLogo.data } });
      }
    }

    // 3. Add brochure images if provided (after template image, main text, and logo)
    brochureImageParts.forEach(part => finalGeminiParts.push(part));

    let resultImages = [];
    let mainImageUrl = "";
    let templateLink = "";

    // Generate based on type
    if (type === 'web') {
      let pagesToGen = businessData.selectedPages || [];
      if (!pagesToGen.includes("Home")) {
          pagesToGen.unshift("Home"); 
      }
      pagesToGen = pagesToGen.slice(0, 3); 

      for (let i = 0; i < pagesToGen.length; i++) {
        const page = pagesToGen[i];
        // Create a new set of parts for each page generation
        const pageSpecificParts = [...finalGeminiParts, {text: `PAGE FOCUS: ${page}. Ensure the UI specific to a ${page} is clearly visible and structured in block sections, suitable for Elementor.`}];

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image', 
          contents: {
            parts: pageSpecificParts
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            }
          }
        });

        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              resultImages.push(`data:image/png;base64,${part.inlineData.data}`);
              break;
            }
          }
        }
      }
      mainImageUrl = resultImages[0];

    } else if (type === 'brochure') {
      const pageCount = businessData.brochurePageCount || 4;
      
      let orientationRatio = "3:4";
      if (businessData.brochureSize === 'square') {
          orientationRatio = "1:1";
      } else {
          orientationRatio = businessData.brochureOrientation === 'landscape' ? "4:3" : "3:4";
      }
      
      const distinctGens = Math.min(pageCount, 4); 

      for (let i = 1; i <= distinctGens; i++) {
          let pageType = "Inner Content Spread";
          if (i === 1) pageType = "Front Cover (Minimalist)";
          else if (i === distinctGens) pageType = "Back Cover (Clean)";
          else if (i === 2 && pageCount > 2) pageType = "Main Service / Product Page";
          else if (i === 3 && pageCount > 3) pageType = "About Us / Contact Page";
          
          // Create a new set of parts for each page generation
          const pageSpecificParts = [...finalGeminiParts, {text: `PAGE FOCUS: ${pageType}.`}];
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: {
              parts: pageSpecificParts
            },
            config: {
              imageConfig: {
                aspectRatio: orientationRatio,
              }
            }
          });

          const candidate = response.candidates?.[0];
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData) {
                resultImages.push(`data:image/png;base64,${part.inlineData.data}`);
                break;
              }
            }
          }
      }

      while (resultImages.length < pageCount) {
          // Fill remaining pages with a random selection from generated images
          resultImages.push(resultImages[Math.floor(Math.random() * resultImages.length)]); 
      }
      mainImageUrl = resultImages[0];

    } else {
      // For logo, identity, social - single generation
      const fullResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
          parts: finalGeminiParts // Use the combined parts here
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          }
        }
      });

      const responseText = fullResponse.text || '';
      const templateMatch = responseText.match(/TEMPLATE_LINK:\s*(https?:\/\/\S+)/i);
      if (templateMatch && templateMatch[1]) {
        templateLink = templateMatch[1];
        console.log("Extracted Template Link:", templateLink);
      }

      const candidate = fullResponse.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            mainImageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      if (!mainImageUrl) throw new Error("The AI model did not return an image for this type. Please try again.");
      resultImages = [mainImageUrl];
    }
    
    // Save design to database
    const designResult = await db.run(
      "INSERT INTO GeneratedDesigns (contact_id, design_type, business_name, industry, description, image_url, template_link, conceptual_template_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      businessData.contactId,
      type,
      businessData.name,
      businessData.industry,
      businessData.description,
      mainImageUrl,
      templateLink, // Save the extracted external template link
      selectedTemplate ? selectedTemplate.id : null // Save the ID of the conceptual template used
    );

    // Send thank-you email
    if (businessData.contactId && businessData.email) { // Ensure email is available from original businessData or fetched
      const leadContact = await db.get("SELECT email, name FROM Leads WHERE id = ?", businessData.contactId);
      if (leadContact) {
        const mailOptions = {
          from: process.env.SENDER_EMAIL,
          to: leadContact.email,
          subject: `Your AI Design from Get Design AI - ${businessData.name}`,
          html: `
            <p>Dear ${leadContact.name || 'User'},</p>
            <p>Thank you for using Get Design AI to create your design! We're thrilled to help you bring your vision to life.</p>
            <p>Your generated design concept for "${businessData.name}" (${type}) is attached below:</p>
            <img src="${mainImageUrl}" alt="Your AI Design" style="max-width: 100%; height: auto; margin: 20px 0;">
            ${templateLink ? `<p>Here's a highly relevant template link for further editing: <a href="${templateLink}">${templateLink}</a></p>` : ''}
            <p>Ready to make it even better? Visit us again: <a href="${process.env.PUBLIC_APP_URL}">${process.env.PUBLIC_APP_URL}</a></p>
            <p>Best regards,</p>
            <p>The Get Design AI Team</p>
          `,
          attachments: [{
            filename: `${businessData.name}_${type}_design.png`,
            path: mainImageUrl.startsWith('data:image') ? Buffer.from(mainImageUrl.split(',')[1], 'base64') : mainImageUrl,
            cid: 'unique@getdesign.cloud' // cid and img src must match
          }]
        };
        try {
          await transporter.sendMail(mailOptions);
          console.log("Thank you email sent to:", leadContact.email);
        } catch (mailError) {
          console.error("Failed to send thank you email:", mailError);
        }
      }
    }


    res.json({
      id: designResult.lastID.toString(), // Use DB ID
      templateId: selectedTemplate ? selectedTemplate.id : `GD-${designResult.lastID.toString().slice(-6)}`, // Pass the conceptual template ID
      templateUrl: "", // This field is not directly used for the conceptual template now
      templateTitle: `Concept GD-${designResult.lastID.toString().slice(-6)}`,
      searchQuery: `${type} design for ${businessData.name}`,
      imageUrl: mainImageUrl,
      images: resultImages,
      timestamp: Date.now(),
      type: type,
      data: businessData,
      templateLink: templateLink, // External template link
      contactId: businessData.contactId,
    });

  } catch (error) {
    console.error('API call failed on server:', error);
    if (req.file) { // Clean up uploaded file if an error occurred
      try { await promisify(fs.unlink)(req.file.path); } catch (e) { console.error("Error cleaning up uploaded file:", e); }
    }
    const errorMessage = handleGeminiError(error); // Use the refined error handler
    res.status(500).json({ error: errorMessage || "Failed to generate design on the server." });
  } finally {
    // Clean up temporary extracted zip directory
    if (req.file) {
      try { await promisify(fs.rm)(tempDir, { recursive: true, force: true }); } catch (e) { console.error("Error cleaning up temp zip directory:", e); }
    }
  }
});

// Admin Authentication
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    // In a real app, generate a JWT. For simplicity, we'll return a basic token.
    const token = "admin-secret-token"; 
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid Credentials" });
  }
});

// Middleware to protect admin routes
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer admin-secret-token"

  if (token == null || token !== "admin-secret-token") { // Simple token validation
    return res.status(403).json({ error: "Forbidden: Invalid or missing token." });
  }
  next();
}

// Admin API to get leads
app.get('/api/admin/leads', authenticateAdmin, async (req, res) => {
  try {
    const leads = await db.all("SELECT id, name, company, email, phone, design_interest, created_at FROM Leads ORDER BY created_at DESC");
    res.json(leads);
  } catch (err) {
    console.error("Database error fetching leads:", err);
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

// Admin API to get generated designs, with search by email or phone
app.get('/api/admin/designs', authenticateAdmin, async (req, res) => {
  const { email, phone } = req.query;
  let query = `
    SELECT gd.id, gd.design_type, gd.business_name, gd.industry, gd.description, gd.image_url, gd.template_link, gd.conceptual_template_id, gd.created_at,
           l.email AS contact_email, l.phone AS contact_phone
    FROM GeneratedDesigns gd
    LEFT JOIN Leads l ON gd.contact_id = l.id
  `;
  const params = [];
  const conditions = [];

  if (email) {
    conditions.push("l.email LIKE ?");
    params.push(`%${email}%`);
  }
  if (phone) {
    conditions.push("l.phone LIKE ?");
    params.push(`%${phone}%`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY gd.created_at DESC";

  try {
    const designs = await db.all(query, ...params);
    res.json(designs);
  } catch (err) {
    console.error("Database error fetching designs:", err);
    res.status(500).json({ error: "Failed to fetch designs." });
  }
});

// Admin API to get all conceptual templates
app.get('/api/admin/conceptual-templates', authenticateAdmin, async (req, res) => {
  try {
    const templates = await db.all("SELECT * FROM ConceptualTemplates ORDER BY id ASC");
    // Parse JSON fields before sending to frontend
    const parsedTemplates = templates.map(t => ({
      ...t,
      industryKeywords: JSON.parse(t.industry_keywords || '[]'),
      generatedContentExamples: JSON.parse(t.generated_content_examples || '{}'),
      type: t.type, // Ensure type is correctly mapped
      visualStyle: t.visual_style, // Ensure visualStyle is correctly mapped
      promptHint: t.prompt_hint,
      thumbnailUrl: t.thumbnail_url,
    }));
    res.json(parsedTemplates);
  } catch (err) {
    console.error("Database error fetching conceptual templates:", err);
    res.status(500).json({ error: "Failed to fetch conceptual templates." });
  }
});

// Admin API to create a new conceptual template
app.post('/api/admin/conceptual-templates', authenticateAdmin, async (req, res) => {
  const { id, type, visualStyle, industryKeywords, promptHint, thumbnailUrl, generatedContentExamples } = req.body;

  if (!id || !type || !visualStyle || !promptHint) {
    return res.status(400).json({ error: "Missing required template fields: id, type, visualStyle, promptHint." });
  }

  try {
    await db.run(
      `INSERT INTO ConceptualTemplates (id, type, visual_style, industry_keywords, prompt_hint, thumbnail_url, generated_content_examples) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, type, visualStyle, JSON.stringify(industryKeywords), promptHint, thumbnailUrl, JSON.stringify(generatedContentExamples)
    );
    res.status(201).json({ message: "Template created successfully." });
  } catch (err) {
    console.error("Database error creating template:", err);
    if (err.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "Template with this ID already exists." });
    }
    res.status(500).json({ error: "Failed to create template." });
  }
});

// Admin API to update an existing conceptual template
app.put('/api/admin/conceptual-templates/:id', authenticateAdmin, async (req, res) => {
  const templateId = req.params.id;
  const { type, visualStyle, industryKeywords, promptHint, thumbnailUrl, generatedContentExamples } = req.body;

  if (!type || !visualStyle || !promptHint) {
    return res.status(400).json({ error: "Missing required template fields: type, visualStyle, promptHint." });
  }

  try {
    const result = await db.run(
      `UPDATE ConceptualTemplates 
       SET type = ?, visual_style = ?, industry_keywords = ?, prompt_hint = ?, thumbnail_url = ?, generated_content_examples = ?
       WHERE id = ?`,
      type, visualStyle, JSON.stringify(industryKeywords), promptHint, thumbnailUrl, JSON.stringify(generatedContentExamples), templateId
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Template not found." });
    }
    res.status(200).json({ message: "Template updated successfully." });
  } catch (err) {
    console.error("Database error updating template:", err);
    res.status(500).json({ error: "Failed to update template." });
  }
});

// Admin API to delete a conceptual template
app.delete('/api/admin/conceptual-templates/:id', authenticateAdmin, async (req, res) => {
  const templateId = req.params.id;
  try {
    const result = await db.run("DELETE FROM ConceptualTemplates WHERE id = ?", templateId);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Template not found." });
    }
    res.status(200).json({ message: "Template deleted successfully." });
  } catch (err) {
    console.error("Database error deleting template:", err);
    res.status(500).json({ error: "Failed to delete template." });
  }
});


// Serve static files from the Vite build output
app.use(express.static(path.join(__dirname, '../dist')));

// For any other routes, serve the index.html (React app)
// This ensures that refreshing or direct access to client-side routes works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});