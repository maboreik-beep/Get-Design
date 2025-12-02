

export type Language = 'en' | 'ar';

// New: Define Translation interface
export interface Translation {
  [key: string]: string;
}

export type DesignType = 'logo' | 'identity' | 'social' | 'brochure' | 'web';

export type VisualStyle = 'minimalist' | 'bold' | 'elegant' | 'playful' | 'futuristic';

export type TemplateCategory = 
  'logo' | 
  'brand_identity' | 
  'social_media' | 
  'brochure_catalog' | 
  'brochure_landscape' | 
  'brochure_portrait' | 
  'tri_fold_flyer' | 
  'website_design';


export type InputMode = 'form' | 'zip'; // New type to control input method

export interface ContactDetails {
  id?: number; // Added for backend primary key
  name: string;
  company: string;
  email: string;
  phone: string;
}

export interface BusinessData {
  name: string;
  industry?: string; 
  description?: string; 
  brief?: string; 
  
  // New Visual Controls
  customColorPalette?: string; // Replaces ColorVibe for custom input or AI inference
  visualStyle?: VisualStyle;

  contactId?: number; // Added to link design to a contact
  selectedPages?: string[]; 
  brochureOrientation?: 'portrait' | 'landscape'; 
  brochurePageCount?: number; 
  brochureSize?: 'a4' | 'a5' | 'square' | 'folded'; 
  logoStyle?: '3d' | 'flat'; 
  socialPlatform?: 'instagram' | 'facebook' | 'linkedin'; 
  postContent?: string; // New field for social media text
  brochureBase64?: string | string[] | null; // Updated to support array of base64 strings
}

export interface GeneratedResult {
  id: string; // Client-side generated ID
  templateId?: string; // Updated: Now stores the conceptual template ID (e.g., 'logo-L1-minimalist-tech')
  templateUrl?: string;
  templateTitle?: string; 
  searchQuery?: string;
  imageUrl: string;
  images?: string[];     
  timestamp: number;
  type: DesignType;
  data: BusinessData;
  templateLink?: string; // New field for recommended template link
  contactId?: number; // Added to link design to a contact in the database
}

export interface Lead {
  id: number; // Added for backend primary key
  date: string;
  name: string;
  company: string;
  job_title?: string; 
  email: string;
  phone: string;
  design_interest: string;
}

export interface GeneratedContentExamples {
  headline: string;
  body: string;
  cta: string;
}

export interface ConceptualTemplate {
  id: string; // Unique identifier for the template, e.g., 'logo-L1-minimalist-tech'
  type: DesignType;
  visualStyle: VisualStyle;
  category: TemplateCategory; // New: Category for grouping templates
  industryKeywords: string[]; // Stored as JSON string in DB, parsed to array
  promptHint: string;
  thumbnailUrl?: string; // Direct public URL for the template image
  generatedContentExamples: GeneratedContentExamples; // Stored as JSON string in DB, parsed to object
}

// Interfaces for Admin Dashboard data (from backend)
export interface LeadRecord {
  id: number; // Added for backend primary key
  name: string;
  company: string;
  email: string;
  phone: string;
  design_interest: string;
  created_at: string;
}

export interface GeneratedDesignRecord {
  id: number;
  contact_id: number;
  design_type: DesignType;
  business_name: string;
  industry: string;
  description: string;
  image_url: string;
  template_link?: string;
  conceptual_template_id?: string; // New field for conceptual template ID
  created_at: string;
  // Potentially include contact info if joined, or fetch separately
  contact_email?: string; 
  contact_phone?: string;
}