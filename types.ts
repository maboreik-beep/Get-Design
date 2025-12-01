

export type Language = 'en' | 'ar';

export type DesignType = 'logo' | 'identity' | 'social' | 'brochure' | 'web';

export type VisualStyle = 'minimalist' | 'bold' | 'elegant' | 'playful' | 'futuristic';

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
}

export interface GeneratedResult {
  id: string; // Client-side generated ID
  templateId?: string; 
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

// Interfaces for Admin Dashboard data (from backend)
export interface LeadRecord {
  id: number;
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
  created_at: string;
  // Potentially include contact info if joined, or fetch separately
  contact_email?: string; 
  contact_phone?: string;
}


export interface Translation {
  title: string;
  subtitle: string;
  cat_graphics: string;
  cat_web: string;
  select_type: string;
  type_logo: string;
  type_identity: string;
  type_social: string;
  type_brochure: string;
  type_web: string;
  tab_upload: string;
  tab_describe: string;
  input_name: string;
  input_industry: string;
  input_description: string; 
  input_pages: string;
  input_brochure_settings: string;
  input_orientation: string;
  orientation_portrait: string;
  orientation_landscape: string;
  input_size: string;
  size_a4: string;
  size_a5: string;
  size_square: string;
  size_folded: string;
  input_page_count: string;
  upload_label: string;
  upload_brochure_label: string;
  generate_btn: string;
  generating: string;
  download_btn: string;
  canva_btn: string;
  source_file_msg: string;
  whatsapp_btn: string;
  error_missing_key: string;
  error_generic: string;
  placeholder_name: string;
  placeholder_industry: string;
  placeholder_description: string; 
  footer_rights: string;
  back_to_menu: string;
  my_creations: string;
  no_creations: string;
  load_design: string;
  delete_design: string;
  // Contact Form
  contact_modal_title: string;
  contact_modal_subtitle: string;
  contact_name: string;
  contact_company: string;
  contact_email: string;
  contact_phone: string;
  contact_submit: string;
  // Validation
  validation_name_req: string;
  validation_company_req: string;
  validation_email: string;
  validation_email_req: string;
  validation_phone: string;
  validation_phone_req: string;
  // Sharing
  share_title: string;
  share_text_template: string;
  share_native_btn: string;
  share_whatsapp: string;
  share_linkedin: string;
  share_facebook: string;
  share_copied: string;
  // New Inputs
  input_logo_style: string;
  style_3d: string;
  style_flat: string;
  input_social_platform: string;
  platform_instagram: string;
  platform_facebook: string;
  platform_linkedin: string;
  // Color & Vibe
  input_color_vibe: string; // Keep this for the label
  input_custom_colors: string; // New label for custom colors
  placeholder_custom_colors: string; // Placeholder for custom colors
  input_visual_style: string;
  style_minimalist: string;
  style_bold: string;
  style_elegant: string;
  style_playful: string;
  style_futuristic: string;
  // Post Content
  input_post_content: string;
  placeholder_post_content: string;
  // Zip Upload
  input_mode_toggle: string;
  mode_form_input: string;
  mode_zip_upload: string;
  upload_zip_label: string;
  zip_uploaded_msg: string;
  zip_upload_hint: string;
  validation_zip_req: string;
  result_template_link: string;
  // Admin Dashboard
  admin_login_title: string;
  admin_username: string;
  admin_password: string;
  admin_login_btn: string;
  admin_invalid_credentials: string;
  admin_leads_title: string;
  admin_designs_title: string;
  admin_refresh: string;
  admin_logout: string;
  admin_no_leads: string;
  admin_no_designs: string;
  admin_search_email: string;
  admin_search_phone: string;
  admin_tab_leads: string;
  admin_tab_designs: string;
  admin_col_date: string;
  admin_col_name: string;
  admin_col_company: string;
  admin_col_email: string;
  admin_col_phone: string;
  admin_col_interest: string;
  admin_col_design_type: string;
  admin_col_business_name: string;
  admin_col_image: string;
  admin_col_template: string;
}