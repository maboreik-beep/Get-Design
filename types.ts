
export type Language = 'en' | 'ar';

export type UserRole = 'admin' | 'coordinator' | 'designer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

export interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  design_interest: string;
  status: 'new' | 'contacted' | 'in_progress' | 'closed';
  notes?: string;
  created_at: string;
}

export interface Template {
  id: number;
  title: string;
  category: TemplateCategory;
  url: string;
  thumbnail_url?: string;
  created_at: string;
}

// Frontend specific types
export interface Translation {
  [key: string]: string;
}

export type DesignType = 'logo' | 'identity' | 'social' | 'brochure' | 'web';
export type VisualStyle = 'minimalist' | 'bold' | 'elegant' | 'playful' | 'futuristic';
export type InputMode = 'form' | 'zip';

export type TemplateCategory = 
  | 'logo' 
  | 'brand_identity' 
  | 'social_media' 
  | 'brochure_catalog'
  | 'brochure_landscape'
  | 'brochure_portrait'
  | 'tri_fold_flyer'
  | 'website_design';

export interface BusinessData {
  name: string;
  industry?: string; 
  description?: string; 
  customColorPalette?: string;
  visualStyle?: VisualStyle;
  contactId?: number;
  selectedPages?: string[]; 
  brochureOrientation?: 'portrait' | 'landscape'; 
  brochurePageCount?: number; 
  brochureSize?: 'a4' | 'a5' | 'square' | 'folded'; 
  logoStyle?: '3d' | 'flat'; 
  socialPlatform?: 'instagram' | 'facebook' | 'linkedin'; 
  postContent?: string;
  brochureBase64?: string | string[] | null;
  templateId?: number; // Selected Reference Template ID
}

export type GeneratedResultStatus = 
  | 'ready' 
  | 'initial_draft_placeholder' 
  | 'ai_draft_generated' 
  | 'pending_designer_review' 
  | 'generating_by_designer' 
  | 'failed';

export interface GeneratedResult {
  id: string;
  status?: GeneratedResultStatus | string;
  imageUrl: string;
  images?: string[];    
  timestamp: number;
  type: DesignType;
  data: BusinessData;
  templateLink?: string;
  templateId?: string | number;
  designTaskId?: number;
}

export interface ContactDetails {
  id?: number;
  name: string;
  company: string;
  email: string;
  phone: string;
}

export interface DesignTask {
  id: number;
  lead_id?: number;
  type: DesignType;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: number; // User ID
  reference_template_id?: number;
  output_url?: string;
  request_details: string; // JSON string of BusinessData
  created_at: string;
  lead_name?: string;     // Joined from Leads
  lead_company?: string;  // Joined from Leads
  assignee_name?: string; // Joined from Users
}
