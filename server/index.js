
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
import ExcelJS from 'exceljs'; // New: Import exceljs

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
      category TEXT NOT NULL, -- New: Category for grouping templates
      industry_keywords TEXT, -- Stored as JSON string: ['tech', 'software']
      prompt_hint TEXT NOT NULL,
      thumbnail_url TEXT, -- Direct URL from Google Drive
      generated_content_examples TEXT -- Stored as JSON string: { headline, body, cta }
    );

    CREATE TABLE IF NOT EXISTS DesignTasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      design_type TEXT NOT NULL, -- Will primarily be 'web'
      business_data TEXT NOT NULL, -- JSON string of BusinessData
      logo_base64 TEXT, -- Stored if provided (string)
      brochure_base64 TEXT, -- Stored if provided (JSON string of string[])
      zip_file_path TEXT, -- Optional: path to the extracted contents if zip was uploaded
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed', 'cancelled'
      generated_design_id INTEGER, -- Link to GeneratedDesigns if completed
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES Leads(id),
      FOREIGN KEY (generated_design_id) REFERENCES GeneratedDesigns(id)
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
      category: 'logo',
      industry_keywords: JSON.stringify(['tech', 'technology', 'software', 'startup', 'digital', 'innovation', 'IT', 'AI', 'data']),
      prompt_hint: 'Design a clean, abstract, geometric logo for a tech company. Focus on a simple, memorable icon, modern typography, and a fresh color palette. Minimalist layout with ample negative space.',
      thumbnail_url: '/assets/templates/logo-L1-minimalist-tech.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'TechFlow Innovations', body: 'Streamlining Tomorrow, Today', cta: 'Explore Solutions' })
    },
    {
      id: 'logo-L2-bold-gaming',
      type: 'logo',
      visual_style: 'bold',
      category: 'logo',
      industry_keywords: JSON.stringify(['gaming', 'esports', 'entertainment', 'interactive', 'virtual reality']),
      prompt_hint: 'Create a bold, dynamic logo with an edgy mascot or icon for a gaming company. Use strong contrasts, energetic colors, and modern, aggressive typography. Emphasize speed, competition, and immersive experiences.',
      thumbnail_url: '/assets/templates/logo-L2-bold-gaming.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Pixel Vanguard', body: 'Conquer Every Realm', cta: 'Join Now' })
    },
    // --- BRAND IDENTITY Templates ---
    {
      id: 'identity-BI1-elegant-luxury',
      type: 'identity',
      visual_style: 'elegant',
      category: 'brand_identity',
      industry_keywords: JSON.stringify(['luxury', 'fashion', 'jewelry', 'boutique', 'high-end', 'premium']),
      prompt_hint: 'Render an elegant and sophisticated brand identity kit flat-lay. Feature a refined logomark, classic serif typography, and a subdued color palette with metallic accents. Include items like embossed business cards, letterhead, and product packaging, highlighting quality and exclusivity.',
      thumbnail_url: '/assets/templates/identity-BI1-elegant-luxury.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Eclat Couture', body: 'Redefining Opulence', cta: 'Discover Our Collection' })
    },
    {
      id: 'identity-BI2-playful-children',
      type: 'identity',
      visual_style: 'playful',
      category: 'brand_identity',
      industry_keywords: JSON.stringify(['children', 'kids', 'toys', 'education', 'play', 'family']),
      prompt_hint: 'Design a whimsical and colorful brand identity kit flat-lay for a children\'s brand. Use a cheerful logotype with rounded letters, playful illustrations, and a bright color scheme. Items include fun business cards, stickers, and product tags, emphasizing joy and creativity.',
      thumbnail_url: '/assets/templates/identity-BI2-playful-children.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Curio Kids Club', body: 'Where Imagination Takes Flight', cta: 'Explore & Play' })
    },
    // --- SOCIAL MEDIA Templates ---
    {
      id: 'social-SM1-minimalist-business',
      type: 'social',
      visual_style: 'minimalist',
      category: 'social_media',
      industry_keywords: JSON.stringify(['corporate', 'business', 'consulting', 'finance', 'professional services']),
      prompt_hint: 'Create a clean, minimalist social media post template for a professional business. Use a neutral color palette with one accent color, clear sans-serif typography, and subtle geometric elements. Focus on a clear message with minimal clutter.',
      thumbnail_url: '/assets/templates/social-SM1-minimalist-business.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Elevate Your Strategy', body: 'Expert Insights for Growth', cta: 'Read Our Whitepaper' })
    },
    {
      id: 'social-SM2-bold-fitness',
      type: 'social',
      visual_style: 'bold',
      category: 'social_media',
      industry_keywords: JSON.stringify(['fitness', 'gym', 'health', 'wellness', 'sports', 'training']),
      prompt_hint: 'Design a bold, high-energy social media post template for a fitness brand. Use strong action imagery, vibrant colors, and impactful, distressed typography. Emphasize strength, motivation, and results.',
      thumbnail_url: '/assets/templates/social-SM2-bold-fitness.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Unleash Your Power', body: 'Transform Your Body, Mind, and Spirit', cta: 'Start Your Journey' })
    },
    // --- BROCHURE/CATALOG Templates ---
    // Brochure-Catalog-Landscape
    {
      id: 'brochure-BL1-futuristic-tech',
      type: 'brochure',
      visual_style: 'futuristic',
      category: 'brochure_landscape',
      industry_keywords: JSON.stringify(['tech', 'software', 'AI', 'robotics', 'innovation', 'future']),
      prompt_hint: 'Design a multi-page landscape brochure with a futuristic and sleek aesthetic. Incorporate glowing lines, abstract geometric patterns, and a dark theme. Use modern sans-serif fonts and clean data visualization elements. Emphasize innovation and advanced technology.',
      thumbnail_url: '/assets/templates/brochure-BL1-futuristic-tech.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Pioneering Tomorrow\'s Solutions', body: 'Our advanced technological platforms are engineered to deliver unparalleled efficiency, driving your enterprise into a new era of digital excellence and innovation.', cta: 'Request a Live Demo' })
    },
    {
      id: 'brochure-BL2-elegant-travel',
      type: 'brochure',
      visual_style: 'elegant',
      category: 'brochure_landscape',
      industry_keywords: JSON.stringify(['travel', 'tourism', 'luxury resort', 'vacation', 'hospitality', 'destinations']),
      prompt_hint: 'Create an elegant landscape brochure for a luxury travel agency. Feature stunning photography of exotic destinations, sophisticated serif typography, and a spacious layout. Use a serene color palette with hints of gold, conveying relaxation and exclusivity.',
      thumbnail_url: '/assets/templates/brochure-BL2-elegant-travel.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Your Journey, Reimagined', body: 'Indulge in bespoke travel experiences meticulously crafted to inspire, enchant, and create indelible memories across the globe.', cta: 'Book Your Escape' })
    },
    // Brochure-Catalog-Portrait
    {
      id: 'brochure-BP1-minimalist-corporate',
      type: 'brochure',
      visual_style: 'minimalist',
      category: 'brochure_portrait',
      industry_keywords: JSON.stringify(['corporate', 'consulting', 'business', 'finance', 'legal']),
      prompt_hint: 'Design a clean, minimalist portrait brochure for a corporate consulting firm. Use a professional blue/grey color scheme, crisp sans-serif typography, and a structured layout with clear sections. Focus on conveying professionalism and clarity.',
      thumbnail_url: '/assets/templates/brochure-BP1-minimalist-corporate.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Strategic Partnership for Success', body: 'We provide tailored consulting services designed to optimize your operations, enhance market position, and drive sustainable business growth.', cta: 'Schedule a Consultation' })
    },
    {
      id: 'brochure-BP2-playful-education',
      type: 'brochure',
      visual_style: 'playful',
      category: 'brochure_portrait',
      industry_keywords: JSON.stringify(['education', 'school', 'university', 'learning', 'kids', 'youth']),
      prompt_hint: 'Create a vibrant, playful portrait brochure for an educational institution. Use a bright, inviting color palette, engaging illustrations, and fun, readable typography. Design for a young audience, emphasizing discovery and interactive learning.',
      thumbnail_url: '/assets/templates/brochure-BP2-playful-education.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Ignite a Passion for Learning', body: 'Our innovative programs and dedicated educators foster a dynamic environment where students thrive, explore, and achieve their fullest potential.', cta: 'Enroll Today' })
    },
    // Tri-Fold Flyer
    {
      id: 'brochure-TF1-bold-marketing',
      type: 'brochure',
      visual_style: 'bold',
      category: 'tri_fold_flyer',
      industry_keywords: JSON.stringify(['marketing', 'advertising', 'agency', 'promotion', 'sales']),
      prompt_hint: 'Design a bold and impactful tri-fold flyer for a marketing agency. Use strong visuals, contrasting colors, and energetic typography to grab attention. Structure clearly defined sections for services, benefits, and contact information.',
      thumbnail_url: '/assets/templates/brochure-TF1-bold-marketing.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Supercharge Your Brand', body: 'Unlock unparalleled visibility and engagement with our innovative marketing strategies, designed to connect you with your audience and drive measurable results.', cta: 'Get Your Free Audit' })
    },
    // --- WEB DESIGN Templates ---
    {
      id: 'web-W1-futuristic-software',
      type: 'web',
      visual_style: 'futuristic',
      category: 'website_design',
      industry_keywords: JSON.stringify(['software', 'cloud', 'AI', 'SaaS', 'platform', 'startup', 'web development']),
      prompt_hint: 'Design a responsive website layout with a futuristic, dark mode aesthetic. Incorporate glowing UI elements, abstract backgrounds, and modern sans-serif typography. Focus on clean data presentation, intuitive navigation, and engaging hero sections for a software product.',
      thumbnail_url: '/assets/templates/web-W1-futuristic-software.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Next-Gen AI Platform', body: 'Empower your business with intelligent automation and data-driven insights, seamlessly integrated into your workflow for unprecedented efficiency.', cta: 'Start Free Trial' })
    },
    {
      id: 'web-W2-elegant-photography',
      type: 'web',
      visual_style: 'elegant',
      category: 'website_design',
      industry_keywords: JSON.stringify(['photography', 'art', 'portfolio', 'creative', 'gallery', 'artist']),
      prompt_hint: 'Create an elegant and minimalist website layout for a professional photography portfolio. Emphasize large, high-quality image displays, subtle hover effects, and sophisticated serif typography. Use a clean, monochromatic color scheme to let the visuals speak. Showcase work with grace and impact.',
      thumbnail_url: '/assets/templates/web-W2-elegant-photography.jpg', // Placeholder, replace with your direct link
      generated_content_examples: JSON.stringify({ headline: 'Capturing Moments, Creating Art', body: 'Discover a curated collection of evocative imagery, each frame a testament to the beauty and emotion found in every moment.', cta: 'View Portfolio' })
    },
  ];

  for (const template of initialTemplates) {
    try {
      await db.run(
        `INSERT INTO ConceptualTemplates (id, type, visual_style, category, industry_keywords, prompt_hint, thumbnail_url, generated_content_examples) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        template.id, template.type, template.visual_style, template.category, template.industry_keywords, 
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

  // First, filter by type (mandatory match)
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

// Helper function to handle AI generation for web designs (used by admin route)
async function performWebDesignGeneration(designTask, contactDetails) {
  if (!ai) {
    throw new Error("Server API Key not configured.");
  }

  const { id: taskId, contact_id, business_data: businessDataJson, logo_base64: logoBase64String, brochure_base664: brochureBase664Json, zip_file_path: zipFilePath } = designTask;
  
  let businessData = JSON.parse(businessDataJson);
  let logoBase64 = logoBase64String;
  let brochureBase64 = brochureBase664Json ? JSON.parse(brochureBase664Json) : [];
  let brochureTextContent = [];
  let brochureImageParts = [];
  let templateLink = "";

  // If a zip was used, re-extract content if zipFilePath is available
  if (zipFilePath && fs.existsSync(zipFilePath)) {
    try {
      const files = await promisify(fs.readdir)(zipFilePath);
      let descriptionFromZip = '';
      let logoFromZip = '';
      let brochureFromZip = [];

      for (const file of files) {
        const filePath = path.join(zipFilePath, file);
        const ext = path.extname(file).toLowerCase();
        const fileName = path.basename(file).toLowerCase();

        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          if (fileName.includes('logo') && !logoFromZip) {
            logoFromZip = `data:image/${ext.substring(1)};base64,${fileBase64}`;
          } else if (fileName.includes('brochure') && !brochureFromZip.length) {
            brochureFromZip.push(`data:image/${ext.substring(1)};base64,${fileBase64}`);
          }
        } else if (['.txt', '.md'].includes(ext)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          if (fileName.includes('description') || fileName.includes('brief')) {
            descriptionFromZip += fileContent + '\n';
          }
        } else if (['.pdf'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          if (fileName.includes('brochure')) {
            brochureFromZip.push(`data:application/pdf;base64,${fileBase64}`);
          }
        } else if (['.docx'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          if (fileName.includes('brochure')) {
            brochureFromZip.push(`data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${fileBase64}`);
          }
        }
      }
      logoBase64 = logoFromZip || logoBase64;
      brochureBase64 = brochureFromZip.length > 0 ? brochureFromZip : brochureBase64;
      businessData.description = descriptionFromZip || businessData.description;
      if (descriptionFromZip && !businessData.name) {
        businessData.name = `Task ${taskId} Project`;
      }
    } catch (zipError) {
      console.error(`Error re-processing zip for task ${taskId}:`, zipError);
    }
  }


  // Process brochureBase64 (can be string or string[])
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
          console.error("Error parsing PDF for task:", pdfError);
        }
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          const buffer = Buffer.from(data, 'base64');
          const result = await mammoth.extractRawText({ buffer: buffer });
          brochureTextContent.push(result.value);
        } catch (docxError) {
          console.error("Error parsing DOCX for task:", docxError);
        }
      } else {
        console.warn("Unsupported brochure file type for task:", mimeType);
      }
    }
  }

  // --- Template Selection & Dynamic Content Generation ---
  const selectedTemplate = await selectTemplate(designTask.design_type, businessData.industry, businessData.visualStyle);
  let templateGuidancePrompt = '';
  let generatedHeadline = businessData.name; // Default to business name
  let generatedBody = businessData.description; // Default to description
  let generatedCta = 'Learn More'; // Default CTA

  // Aspect ratio for image generation (default for single images)
  const aspectRatio = "16:9"; // Fixed for web designs

  if (businessData.postContent) {
    generatedHeadline = businessData.postContent.split('\n')[0] || generatedHeadline;
    generatedBody = businessData.postContent.split('\n').slice(1).join(' ') || generatedBody;
  } else if (selectedTemplate) {
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
      generatedBody = contentJson.body || contentJson.text || generatedBody;
      generatedCta = contentJson.cta || generatedCta;
      console.log("Generated Content (AI):", generatedHeadline, generatedBody, generatedCta);

    } catch (contentError) {
      console.warn("Failed to generate content via AI for task:", contentError);
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
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      finalGeminiParts.push({ inlineData: { mimeType: contentType, data: base64Image } });
    } catch (imgFetchError) {
      console.warn(`Could not fetch or process template thumbnail from URL for task ${taskId}: ${selectedTemplate.thumbnail_url}`, imgFetchError);
    }
  }

  let industryInstruction = `
    INDUSTRY CONTEXT: "${businessData.industry || 'General Business'}".
    VISUAL STYLE PREFERENCE: "${businessData.visualStyle || 'Adapt to the template\'s dominant style'}"
    COLOR PALETTE GUIDANCE: "${businessData.customColorPalette || 'Derive main colors from logo (if provided) or industry norms, ensuring a harmonious and professional look.'}"
    DESIGN PRINCIPLES: Ensure the design is modern, professional, visually appealing, and directly relevant to the business and chosen style.
  `;

  let specificPrompt = `DESIGN TYPE: Website Design. Layout for a modern, responsive website.`;

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

  let pagesToGen = businessData.selectedPages || [];
  if (!pagesToGen.includes("Home")) {
      pagesToGen.unshift("Home"); 
  }
  pagesToGen = pagesToGen.slice(0, 3); // Limit to max 3 pages

  const generationPromises = pagesToGen.map(async (page) => {
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
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null; // Return null if no image generated for this page
  });

  const generatedPageImages = await Promise.all(generationPromises);
  resultImages = generatedPageImages.filter(img => img !== null); // Filter out nulls
  mainImageUrl = resultImages[0] || '';

  if (!mainImageUrl) throw new Error("The AI model did not return any images for the website design. Please try again or refine your prompt.");

  // Save design to database
  const designResult = await db.run(
    "INSERT INTO GeneratedDesigns (contact_id, design_type, business_name, industry, description, image_url, template_link, conceptual_template_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    contact_id, // From DesignTask
    designTask.design_type,
    businessData.name,
    businessData.industry,
    businessData.description,
    mainImageUrl,
    selectedTemplate ? selectedTemplate.thumbnail_url : null, // Use thumbnail_url as template_link
    selectedTemplate ? selectedTemplate.id : null
  );

  return {
    id: designResult.lastID.toString(),
    templateId: selectedTemplate ? selectedTemplate.id : `GD-${designResult.lastID.toString().slice(-6)}`,
    templateUrl: selectedTemplate ? selectedTemplate.thumbnail_url : null,
    templateTitle: selectedTemplate ? selectedTemplate.id : `Concept GD-${designResult.lastID.toString().slice(-6)}`,
    searchQuery: `${designTask.design_type} design for ${businessData.name}`,
    imageUrl: mainImageUrl,
    images: resultImages,
    timestamp: Date.now(),
    type: designTask.design_type,
    data: businessData,
    contactId: contact_id,
  };
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
    if (err.message.includes("UNIQUE constraint failed")) {
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
  }
  catch (err) {
    console.error("Database error fetching leads:", err);
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

// Admin API to export leads to Excel
app.get('/api/admin/leads/export', authenticateAdmin, async (req, res) => {
  try {
    const leads = await db.all("SELECT id, name, company, email, phone, design_interest, created_at FROM Leads ORDER BY created_at DESC");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Company', key: 'company', width: 30 },
      { header: 'Email', key: 'email', width: 40 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Design Interest', key: 'design_interest', width: 25 },
      { header: 'Created At', key: 'created_at', width: 25 },
    ];

    leads.forEach(lead => {
      worksheet.addRow(lead);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Error exporting leads to Excel:", err);
    res.status(500).json({ error: "Failed to export leads." });
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

// Admin API to export designs to Excel
app.get('/api/admin/designs/export', authenticateAdmin, async (req, res) => {
  try {
    const designs = await db.all(`
      SELECT gd.id, gd.design_type, gd.business_name, gd.industry, gd.description, gd.image_url, gd.template_link, gd.conceptual_template_id, gd.created_at,
             l.name AS contact_name, l.company AS contact_company, l.email AS contact_email, l.phone AS contact_phone
      FROM GeneratedDesigns gd
      LEFT JOIN Leads l ON gd.contact_id = l.id
      ORDER BY gd.created_at DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Generated Designs');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Design Type', key: 'design_type', width: 20 },
      { header: 'Business Name', key: 'business_name', width: 30 },
      { header: 'Industry', key: 'industry', width: 25 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Image URL', key: 'image_url', width: 60 },
      { header: 'Template Link', key: 'template_link', width: 40 },
      { header: 'Conceptual Template ID', key: 'conceptual_template_id', width: 30 },
      { header: 'Created At', key: 'created_at', width: 25 },
      { header: 'Contact Name', key: 'contact_name', width: 30 },
      { header: 'Contact Company', key: 'contact_company', width: 30 },
      { header: 'Contact Email', key: 'contact_email', width: 40 },
      { header: 'Contact Phone', key: 'contact_phone', width: 20 },
    ];

    designs.forEach(design => {
      worksheet.addRow(design);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=generated_designs.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Error exporting designs to Excel:", err);
    res.status(500).json({ error: "Failed to export designs." });
  }
});


// Admin API to get all conceptual templates
app.get('/api/admin/conceptual-templates', authenticateAdmin, async (req, res) => {
  const { category } = req.query;
  let query = "SELECT * FROM ConceptualTemplates";
  const params = [];

  if (category && category !== 'all') {
    query += " WHERE category = ?";
    params.push(category);
  }
  query += " ORDER BY id ASC";

  try {
    const templates = await db.all(query, ...params);
    // Parse JSON fields before sending to frontend
    const parsedTemplates = templates.map(t => ({
      id: t.id,
      type: t.type, // Ensure type is correctly mapped
      visualStyle: t.visual_style, // Ensure visualStyle is correctly mapped
      category: t.category, // Ensure category is correctly mapped
      industryKeywords: JSON.parse(t.industry_keywords || '[]'),
      promptHint: t.prompt_hint,
      thumbnailUrl: t.thumbnail_url,
      generatedContentExamples: JSON.parse(t.generated_content_examples || '{}'),
    }));
    res.json(parsedTemplates);
  } catch (err) {
    console.error("Database error fetching conceptual templates:", err);
    res.status(500).json({ error: "Failed to fetch conceptual templates." });
  }
});

// Admin API to create a new conceptual template
app.post('/api/admin/conceptual-templates', authenticateAdmin, async (req, res) => {
  const { id, type, visualStyle, category, industryKeywords, promptHint, thumbnailUrl, generatedContentExamples } = req.body;

  if (!id || !type || !visualStyle || !category || !promptHint) {
    return res.status(400).json({ error: "Missing required template fields: id, type, visualStyle, category, promptHint." });
  }

  try {
    await db.run(
      `INSERT INTO ConceptualTemplates (id, type, visual_style, category, industry_keywords, prompt_hint, thumbnail_url, generated_content_examples) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, type, visualStyle, category, JSON.stringify(industryKeywords), promptHint, thumbnailUrl, JSON.stringify(generatedContentExamples)
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
  const { type, visualStyle, category, industryKeywords, promptHint, thumbnailUrl, generatedContentExamples } = req.body;

  if (!type || !visualStyle || !category || !promptHint) {
    return res.status(400).json({ error: "Missing required template fields: type, visualStyle, category, promptHint." });
  }

  try {
    const result = await db.run(
      `UPDATE ConceptualTemplates 
       SET type = ?, visual_style = ?, category = ?, industry_keywords = ?, prompt_hint = ?, thumbnail_url = ?, generated_content_examples = ?
       WHERE id = ?`,
      type, visualStyle, category, JSON.stringify(industryKeywords), promptHint, thumbnailUrl, JSON.stringify(generatedContentExamples), templateId
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


// NEW: Endpoint to create a Design Task (for web designs)
app.post('/api/design-tasks', upload.single('zipFile'), async (req, res) => {
  let { type, businessData, logoBase64 } = req.body;
  
  if (typeof businessData === 'string') {
    businessData = JSON.parse(businessData);
  }

  if (type !== 'web' || !businessData.contactId) {
    return res.status(400).json({ error: "Invalid request for design task. Only 'web' type with contactId is supported." });
  }

  // Extract brochureBase64 from parsed businessData if present
  let brochureBase64 = businessData.brochureBase64;
  if (typeof brochureBase64 === 'string') brochureBase64 = [brochureBase64];
  if (!brochureBase64) brochureBase64 = [];


  let zipFilePath = null;
  const tempDir = path.join(os.tmpdir(), `upload-${Date.now()}`); // Temp dir for zip extraction

  try {
    if (req.file) {
      await promisify(fs.mkdir)(tempDir, { recursive: true });
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(tempDir, true);
      zipFilePath = tempDir; // Store path to extracted contents for later use
    }
    
    // Create the Design Task
    const result = await db.run(
      `INSERT INTO DesignTasks (contact_id, design_type, business_data, logo_base64, brochure_base64, zip_file_path, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      businessData.contactId,
      type,
      JSON.stringify(businessData),
      logoBase64 || null,
      JSON.stringify(brochureBase64),
      zipFilePath,
      'pending'
    );

    res.status(201).json({
      id: `task-${result.lastID}`,
      designTaskId: result.lastID,
      status: 'pending_designer_review', // Indicate draft is pending review
      type: type,
      imageUrl: '/assets/pending-web-design.svg', // Placeholder image
      timestamp: Date.now(),
      data: businessData,
      contactId: businessData.contactId,
    });

  } catch (error) {
    console.error('API call failed on server:', error);
    if (req.file) {
      try { await promisify(fs.unlink)(req.file.path); } catch (e) { console.error("Error cleaning up uploaded file:", e); }
    }
    if (zipFilePath && fs.existsSync(zipFilePath)) { // Clean up extracted dir on error
      try { await promisify(fs.rm)(zipFilePath, { recursive: true, force: true }); } catch (e) { console.error("Error cleaning up temp zip directory:", e); }
    }
    const errorMessage = handleGeminiError(error);
    res.status(500).json({ error: errorMessage || "Failed to create design task on the server." });
  } finally {
    if (req.file) { // Clean up uploaded zip file
      try { await promisify(fs.unlink)(req.file.path); } catch (e) { console.error("Error cleaning up uploaded zip file:", e); }
    }
  }
});


// NEW: Admin API to get all Design Tasks
app.get('/api/admin/design-tasks', authenticateAdmin, async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT dt.*, l.name AS contact_name, l.email AS contact_email, l.phone AS contact_phone
    FROM DesignTasks dt
    LEFT JOIN Leads l ON dt.contact_id = l.id
  `;
  const params = [];

  if (status && status !== 'all') {
    query += " WHERE dt.status = ?";
    params.push(status);
  }
  query += " ORDER BY dt.created_at DESC";

  try {
    const tasks = await db.all(query, ...params);
    res.json(tasks);
  } catch (err) {
    console.error("Database error fetching design tasks:", err);
    res.status(500).json({ error: "Failed to fetch design tasks." });
  }
});

// NEW: Admin API to trigger AI generation for a specific Design Task
app.post('/api/admin/design-tasks/:taskId/generate', authenticateAdmin, async (req, res) => {
  const taskId = req.params.taskId;

  // Respond immediately to the client that generation has started
  res.status(202).json({ status: 'generating', message: 'AI generation started in background.' });

  // Execute AI generation in the background
  (async () => {
    let designTask;
    let contactDetails;
    try {
      designTask = await db.get("SELECT * FROM DesignTasks WHERE id = ?", taskId);
      if (!designTask) {
        console.error(`Background task failed: Design task ${taskId} not found.`);
        return;
      }
      if (designTask.status === 'generating') { // Prevent re-triggering if already generating
        console.warn(`Background task for ${taskId} is already generating.`);
        return;
      }
      
      // Update status to generating
      await db.run("UPDATE DesignTasks SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = ?", taskId);
      
      // Get contact details for email notification
      contactDetails = await db.get("SELECT email, name FROM Leads WHERE id = ?", designTask.contact_id);

      // Perform the actual AI generation for the web design
      const generatedDesign = await performWebDesignGeneration(designTask, contactDetails);

      // Update DesignTask with completed status and link to generated design
      await db.run(
        "UPDATE DesignTasks SET status = 'completed', generated_design_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        generatedDesign.id, taskId
      );

      // Send email to user that design is ready
      if (contactDetails && contactDetails.email) {
        const designLink = `${process.env.PUBLIC_APP_URL || 'https://www.getdesign.cloud'}#result-${generatedDesign.id}`;
        const mailOptions = {
          from: process.env.SENDER_EMAIL,
          to: contactDetails.email,
          subject: `Your Website Design is Ready from Get Design AI!`,
          html: `
            <p>Dear ${contactDetails.name || 'User'},</p>
            <p>Great news! Your website design concept for "${JSON.parse(designTask.business_data).name}" has been generated and is ready for your review.</p>
            <p>You can view your design here: <a href="${designLink}">${designLink}</a></p>
            <img src="${generatedDesign.imageUrl}" alt="Your Website Design" style="max-width: 100%; height: auto; margin: 20px 0;">
            <p>Best regards,</p>
            <p>The Get Design AI Team</p>
          `,
          attachments: [{
            filename: `${JSON.parse(designTask.business_data).name}_website_design.png`,
            path: generatedDesign.imageUrl.startsWith('data:image') ? Buffer.from(generatedDesign.imageUrl.split(',')[1], 'base64') : generatedDesign.imageUrl,
            cid: 'unique@getdesign.cloud'
          }]
        };
        try {
          await transporter.sendMail(mailOptions);
          console.log("Website design ready email sent to:", contactDetails.email);
        } catch (mailError) {
          console.error("Failed to send website ready email for task:", taskId, mailError);
        }
      }

    } catch (error) {
      console.error(`Background generation task ${taskId} failed:`, error);
      await db.run("UPDATE DesignTasks SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", taskId); // Mark as failed
      // No response can be sent to client from here, as client already received 202.
    } finally {
      // Clean up temporary zip extraction directory if it exists and was created for this task
      const task = await db.get("SELECT zip_file_path FROM DesignTasks WHERE id = ?", taskId);
      if (task?.zip_file_path && fs.existsSync(task.zip_file_path)) {
        try { await promisify(fs.rm)(task.zip_file_path, { recursive: true, force: true }); } catch (e) { console.error("Error cleaning up task's temp zip directory:", e); }
      }
    }
  })();
});


// API Endpoint for general design generation (now also handles web via task creation)
app.post('/api/generate-design', upload.single('zipFile'), async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Server API Key not configured. Please contact support." });
  }

  let { type, businessData, logoBase64 } = req.body;
  
  // businessData comes as string from FormData, parse it
  if (typeof businessData === 'string') {
    businessData = JSON.parse(businessData);
  }

  // Extract brochureBase64 from parsed businessData if present
  let brochureBase64 = businessData.brochureBase64;
  if (typeof brochureBase64 === 'string') brochureBase64 = [brochureBase64];
  if (!brochureBase64) brochureBase64 = [];


  let descriptionFromZip = ''; // To store description extracted from zip
  let logoFromZip = ''; // To store logo extracted from zip
  let brochureFromZip = []; // To store brochure extracted from zip

  const tempDir = path.join(os.tmpdir(), `upload-${Date.now()}`); // Temp dir for zip extraction
  let zipFileCreated = false;

  try {
    if (req.file) { // If a zip file was uploaded
      console.log('Zip file received:', req.file.originalname);
      await promisify(fs.mkdir)(tempDir, { recursive: true }); // Create temp dir
      zipFileCreated = true;

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
          } else if (fileName.includes('brochure') && !brochureFromZip.length) {
            brochureFromZip.push(`data:image/${ext.substring(1)};base64,${fileBase64}`);
          }
          // If no specific name, just take the first image found as a generic asset
          if (!logoFromZip && !brochureFromZip.length) {
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
            brochureFromZip.push(`data:application/pdf;base64,${fileBase64}`);
          }
        } else if (['.docx'].includes(ext)) {
          const fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
          if (fileName.includes('brochure')) {
            brochureFromZip.push(`data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${fileBase64}`);
          }
        }
      }
      // Prioritize zip-extracted content over form-based uploads for images
      logoBase64 = logoFromZip || logoBase64;
      brochureBase64 = brochureFromZip.length > 0 ? brochureFromZip : (brochureBase64 || []); // Treat as array from zip

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
          DESIGN CONCEPT: Base the overall layout, composition