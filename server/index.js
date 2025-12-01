// server/index.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import nodemailer from 'nodemailer';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';

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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES Leads(id)
    );
  `);
  console.log('Database initialized.');
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
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

async function generateSingleImage(geminiAIInstance, prompt, base64Image, aspectRatio = "1:1") {
  if (!geminiAIInstance) {
    throw new Error("Gemini AI not initialized due to missing API Key on the server.");
  }
  try {
    const parts = [];
    
    if (base64Image) {
      parts.push({
        inlineData: {
          mimeType: 'image/png', // Assume PNG for simplicity for base64 images
          data: base64Image
        }
      });
    }

    parts.push({ text: prompt });

    const response = await geminiAIInstance.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
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

    throw new Error("The AI model did not return an image. Please try again.");
  } catch (error) {
    throw new Error(handleGeminiError(error)); // Re-throw after handling for the route handler to catch
  }
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
            logoFromZip = fileBase64;
          } else if (fileName.includes('brochure') && !brochureFromZip) {
            brochureFromZip = fileBase64;
          }
          // If no specific name, just take the first image found as a generic asset
          if (!logoFromZip && !brochureFromZip) {
            logoFromZip = fileBase64; // Fallback: use first image as logo
          }
        } else if (['.txt', '.md'].includes(ext)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          if (fileName.includes('description') || fileName.includes('brief')) {
            descriptionFromZip += fileContent + '\n';
          }
        }
      }
      // Prioritize zip-extracted content over form-based uploads for images
      logoBase64 = logoFromZip || logoBase64;
      brochureBase64 = brochureFromZip || brochureBase64;

      // Augment or replace description
      businessData.description = descriptionFromZip || businessData.description;
      if (descriptionFromZip && !businessData.name) {
        businessData.name = req.file.originalname.replace('.zip', '') || 'Zip Project';
      }

    } else {
      console.log('No zip file uploaded, using form data.');
    }

    // --- Gemini Prompt Construction ---
    // 1. Establish Concept & Style
    let colorGuidance = "";

    if (logoBase64) {
      colorGuidance += "PRIMARY COLOR PALETTE SOURCE: Derive the main color scheme (primary, secondary, accent colors) directly from the provided 'logoBase64' image. Analyze its dominant hues and tones to create a harmonious and high-contrast palette. ";
    } else if (brochureBase64 && (type === 'brochure' || type === 'web')) {
      colorGuidance += "PRIMARY COLOR PALETTE SOURCE: Derive the main color scheme (primary, secondary, accent colors) directly from the provided 'brochureBase64' image content. Analyze its dominant hues and tones to create a harmonious and high-contrast palette. ";
    }

    if (businessData.customColorPalette) {
      if (colorGuidance) { 
        colorGuidance += `Additionally, refine or complement the derived palette with these user-specified color preferences: "${businessData.customColorPalette}". Incorporate precise HEX/RGB/HSL codes if provided. `;
      } else { 
        colorGuidance += `COLOR PALETTE: Use the following user-specified colors as the primary guidance for the design. Ensure high contrast and visual richness: "${businessData.customColorPalette}". Incorporate precise HEX/RGB/HSL codes if provided. `;
      }
    }

    if (!colorGuidance) { 
        colorGuidance = `COLOR PALETTE: Automatically generate an innovative and unforgettable color palette. Apply an audacious 60-30-10 color rule (dominant, secondary, accent). Prioritize unique, high-contrast pairings that evoke strong emotional responses and achieve a world-class, memorable aesthetic. Emphasize distinct light/dark contrast.`;
    }

    const industryInstruction = `
      INDUSTRY CONTEXT: "${businessData.industry || 'General Business'}".
      VISUAL STYLE: "${businessData.visualStyle || 'Minimalist'}".
      
      DESIGN PRINCIPLES (SENIOR ART DIRECTOR): 
      1. **Color Mastery**: Apply the defined or inferred palette strictly. High contrast, emotional resonance, and strategic color psychology relevant to the industry are paramount.
      2. **Typography**: Use elegant, legible sans-serifs (like Inter, Helvetica Now) for body, and a distinguished serif or modern display font for headlines, reflecting the chosen visual style. Prioritize hierarchy.
      3. **Composition**: Adhere to classical design principles like Golden Ratio and Rule of Thirds. Master negative space to create visual calm and focus. Ensure all elements breathe.
      4. **Mockup Realism**: This is a HYPER-REALISTIC PHOTO SHOOT, not a flat render. Render with tangible textures and perfect lighting.
      5. **Template Link Suggestion**: After generating the design, provide a single, highly relevant template link from Envato, Freepik, Adobe Stock, or Shutterstock. This link should match the generated design's style, industry, and type (e.g., "Envato Elements brochure template for [Industry]"). Format as "TEMPLATE_LINK: [URL]".
    `;

    // 2. Construct SPECIFIC Prompt
    let specificPrompt = "";
    let aspectRatio = "1:1";

    switch (type) {
      case 'logo':
        aspectRatio = "1:1";
        if (businessData.logoStyle === 'flat') {
          specificPrompt = `TASK: Create a World-Class Minimalist Logo Concept.
          OBJECT: A brilliant, unique, and memorable logo mark representing "${businessData.industry}".
          STYLE: Swiss Design Principles. Flat, vector-based. Use negative space intelligently. Typography is a custom, modern sans-serif. Reference Envato, Freepik, Adobe Stock, Shutterstock for best-in-class examples.
          PRESENTATION: Top-down view on a premium, uncoated matte paper. Sharp focus. Soft studio lighting.`;
        } else {
          specificPrompt = `TASK: Render a Hyper-Realistic 3D Logo Signage Mockup.
          OBJECT: The logo mounted on a high-end architectural surface.
          MATERIAL & TEXTURE: 
          - If the inferred/custom palette is dark-dominant, use Brushed Gold on Dark Italian Marble.
          - If the inferred/custom palette is bright-dominant with green, use Illuminated Acrylic (edge-lit) on Polished Concrete.
          - If the inferred/custom palette is earthy, use Embossed Recycled Wood or Patinated Copper on a living moss wall.
          - Otherwise, select materials that best complement the derived color palette.
          LIGHTING: Cinematic Global Illumination with subtle volumetric fog. Exquisite depth of field. Soft rim lighting. Reference Envato, Freepik, Adobe Stock, Shutterstock for best-in-class examples.`;
        }
        break;
        
      case 'web':
        aspectRatio = "16:9";
        specificPrompt = `TASK: Render a Clean, Elementor-Friendly Website Page UI Mockup.
        OBJECT: A modern desktop screen or tablet, clearly displaying a full website page UI.
        UI DESIGN PRINCIPLES (Elementor Best Practices):
        - Layout: Clean, block-based design with distinct sections. Emphasize responsiveness and logical flow.
        - Aesthetics: Flat, modern, and uncluttered. Focus on excellent negative space, clear visual hierarchy, and intuitive user experience. Avoid complex overlapping layers or glassmorphism.
        - Typography: Clear, legible sans-serifs for both headlines and body text. Good line height and paragraph spacing.
        - Imagery: High-quality, relevant photography or clean vector illustrations, integrated seamlessly within sections.
        ENVIRONMENT: A bright, professional, and minimalist workspace background that enhances the screen content without distraction. The UI should be the focal point, designed for readability and conversion. Reference Envato for best-in-class Elementor-compatible web templates.`;
        break;
        
      case 'brochure':
        if (businessData.brochureSize === 'square') {
            aspectRatio = "1:1";
        } else {
            aspectRatio = businessData.brochureOrientation === 'landscape' ? "4:3" : "3:4";
        }
        const sizeDesc = businessData.brochureSize === 'folded' ? 'Tri-Fold Flyer' : (businessData.brochureSize || 'A4').toUpperCase();
        specificPrompt = `TASK: Render a COMPLETE, Print-Ready, Multi-Page Brochure Mockup.
        OBJECT: An open ${sizeDesc} brochure spread, meticulously arranged on a sophisticated surface (e.g., brushed concrete, dark wood, or a clean white minimalist desk). The image should convey that this is a fully designed, ready-to-print document.
        CONTENT EMPHASIS: Show a realistic mix of strong headlines, engaging body text, high-quality product or service photography, infographics (if relevant to industry), and clear call-to-actions. The content should feel robust and informative, not just filler.
        PAPER TEXTURE: Visible, tactile grain. Premium uncoated matte finish. The paper should feel substantial. Simulate debossing or spot UV on key elements.
        PRINT QUALITY: Simulate perfect CMYK printing. Crisp, deep black ink and vibrant spot colors. Perfect registration, showing attention to detail found in luxury print. Ensure text is razor-sharp and legible.
        TYPOGRAPHY: Impeccable kerning and leading. Clear visual hierarchy for easy readability. Use a maximum of two complementary font families.
        LIGHTING: Controlled natural light from a large window, creating soft, long, elegant shadows and subtle highlights on the paper's texture. Use global illumination for maximum realism. Reference Envato, Freepik, Adobe Stock, Shutterstock for best-in-class brochure templates and mockups.
        FOCUS: Razor-sharp focus on the typography and graphic details. The design must look genuinely printed and ready for a luxury client.`;
        break;
        
      case 'social':
        const platform = businessData.socialPlatform || 'instagram';
        if (platform === 'facebook' || platform === 'linkedin') {
            aspectRatio = "16:9"; 
        } else {
            aspectRatio = "1:1"; 
        }
        
        const contentText = businessData.postContent ? `"${businessData.postContent}"` : "CAPTIVATING HEADLINE TEXT HERE";

        specificPrompt = `TASK: Create a Viral-Caliber Social Media Graphic.
        FORMAT: Optimized for ${platform} Layout.
        STYLE: "Scroll-Stopping" Visuals. High-impact. Awwwards/Behance-trending aesthetic. Reference Envato, Freepik, Adobe Stock, Shutterstock for trending social media graphics.
        TEXT CONTENT: The design MUST prominently and elegantly feature this marketing message: "${contentText}".
        COMPOSITION:
        - Background: Dynamic brand color gradient, luxurious texture, or an industry-relevant high-definition background image with depth.
        - Hero Element: A beautifully cut-out product shot, an expressive human element, or a striking graphic illustration (all high definition).
        - Typography: Massive, bold, modern sans-serif (e.g., "Anton", "Poppins", "Inter"). Clear visual hierarchy with strategic use of negative space.
        - Vibe: Curated, Influencer-tier quality. A design that demands attention and engagement.`;
        break;
        
      case 'identity':
        aspectRatio = "4:3";
        specificPrompt = `TASK: Render a COMPREHENSIVE, World-Class Corporate Brand Identity Kit (Knolling style flat-lay).
        OBJECTS: Arrange a wide array of branded items in a perfectly organized, symmetrical flat-lay grid. This includes:
        - Business Card (front and back, distinctively laid out)
        - A4 Letterhead
        - Standard C5 Envelope
        - Small Gift Box or Shopping Bag
        - Branded Coffee Mug or Tumbler
        - Sleek Notebook or Journal (open to a branded page)
        - Branded Pen/Pencil set
        - USB Drive or Keyring
        - Mobile Phone screen displaying a branded app UI
        - Small branded Pin Badge or Lapel Pin
        - CD/DVD with branded label (if applicable for the industry)
        - Branded T-shirt or Cap
        - Desktop Wallpaper or Digital Background
        - Social Media Profile Icon and Cover Image
        ARRANGEMENT: Each item should be positioned with precision, showing its branding clearly and creating a harmonious, visually rich composition. Reference Envato, Freepik, Adobe Stock, Shutterstock for diverse and complete brand identity mockups.
        MATERIALS: Premium uncoated cotton paper for stationery, fine matte cardstock for business cards, quality ceramics for the mug, sleek metal for the pen/USB. Subtle debossing, foil stamping, or spot UV on logos where appropriate.
        LIGHTING: Soft, diffused overhead studio lighting with gentle, long, realistic shadows to enhance depth and texture. Global illumination for hyper-realism.
        COLOR ACCENTS: Brand primary color should appear subtly on paper edges (edge painting effect on business cards) and within UI elements on the phone screen. All items should cohesively integrate the chosen brand palette.`;
        break;
    }

    const finalPrompt = `
      ${specificPrompt}
      
      BRANDING INTEGRATION:
      - Business Name: "${businessData.name}" (Render legibly as per design. DO NOT add "Get Design" text to the logo or main content).
      - Description Context: "${businessData.description}".
      - ${industryInstruction}
      - ${colorGuidance}
      - If a logo image is provided, integrate it seamlessly and realistically as the primary logo element.

      RENDER QUALITY SETTINGS (FOR VISUAL CLARITY & DIGITAL PRESENTATION):
      1. **Presentation**: Clean, sharp, and easy to understand. Optimized for digital display.
      2. **Details**: Crisp lines, clear text, precise graphics.
      3. **Lighting**: Even, soft ambient lighting to ensure all design elements are visible and legible.
      4. **Reflections**: Subtle, functional reflections only if they enhance UI clarity, not distract.
      5. **Post-Processing**: Balanced contrast and color correction for a vibrant, modern digital aesthetic.
      
      STRICT CONSTRAINT: The design must look ABSOLUTELY FINISHED, production-ready, and already EXISTS as a physical or digital product. NO sketches, NO blurry text, NO placeholder indicators.
    `;

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
        const pagePrompt = `${finalPrompt}
        PAGE FOCUS: ${page}.
        Ensure the UI specific to a ${page} is clearly visible and structured in block sections, suitable for Elementor.`;
        const img = await generateSingleImage(ai, pagePrompt, logoBase64 || brochureBase64, "16:9");
        resultImages.push(img);
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
          
          const pagePrompt = `${finalPrompt}
          PAGE FOCUS: ${pageType}.`;
          
          const img = await generateSingleImage(ai, pagePrompt, logoBase64 || brochureBase64, orientationRatio);
          resultImages.push(img);
      }

      while (resultImages.length < pageCount) {
          resultImages.push(resultImages[Math.floor(Math.random() * (resultImages.length > 1 ? resultImages.length - 1 : 1)) + 1]); 
      }
      mainImageUrl = resultImages[0];

    } else {
      // For logo, identity, social
      const fullResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
          parts: [
            ...(logoBase64 ? [{ inlineData: { mimeType: 'image/png', data: logoBase64 } }] : []),
            { text: finalPrompt }
          ]
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
      "INSERT INTO GeneratedDesigns (contact_id, design_type, business_name, industry, description, image_url, template_link) VALUES (?, ?, ?, ?, ?, ?, ?)",
      businessData.contactId,
      type,
      businessData.name,
      businessData.industry,
      businessData.description,
      mainImageUrl,
      templateLink // Save the extracted template link
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
      templateId: `GD-${designResult.lastID.toString().slice(-6)}`,
      templateUrl: "", 
      templateTitle: `Concept GD-${designResult.lastID.toString().slice(-6)}`,
      searchQuery: `${type} design for ${businessData.name}`,
      imageUrl: mainImageUrl,
      images: resultImages,
      timestamp: Date.now(),
      type: type,
      data: businessData,
      templateLink: templateLink,
      contactId: businessData.contactId,
    });

  } catch (error) {
    console.error('API call failed on server:', error);
    if (req.file) { // Clean up uploaded file if an error occurred
      try { await promisify(fs.unlink)(req.file.path); } catch (e) { console.error("Error cleaning up uploaded file:", e); }
    }
    res.status(500).json({ error: error.message || "Failed to generate design on the server." });
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
    SELECT gd.id, gd.design_type, gd.business_name, gd.industry, gd.description, gd.image_url, gd.template_link, gd.created_at,
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