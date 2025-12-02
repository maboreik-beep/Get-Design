import React, { useState, useEffect } from 'react';
import { LeadRecord, GeneratedDesignRecord, Language, ConceptualTemplate, DesignType, VisualStyle, GeneratedContentExamples } from '../types';
import { TRANSLATIONS } from '../constants';

// Define a type alias for the initial seed templates to help TypeScript correctly infer the type
type InitialConceptualTemplateSeed = Omit<ConceptualTemplate, 'industryKeywords' | 'generatedContentExamples'> & {
  industryKeywords: string[];
  generatedContentExamples: GeneratedContentExamples;
};

// Helper for initial template seed data (moved from server)
const initialSeedTemplates: InitialConceptualTemplateSeed[] = [
  // --- LOGO Templates ---
  {
    id: 'logo-L1-minimalist-tech',
    type: 'logo',
    visualStyle: 'minimalist',
    industryKeywords: ['tech', 'technology', 'software', 'startup', 'digital', 'innovation', 'IT', 'AI', 'data'],
    promptHint: 'Design a clean, abstract, geometric logo for a tech company. Focus on a simple, memorable icon, modern typography, and a fresh color palette. Minimalist layout with ample negative space.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'TechFlow Innovations',
      body: 'Streamlining Tomorrow, Today',
      cta: 'Explore Solutions'
    }
  },
  {
    id: 'logo-L2-bold-gaming',
    type: 'logo',
    visualStyle: 'bold',
    industryKeywords: ['gaming', 'esports', 'entertainment', 'interactive', 'virtual reality'],
    promptHint: 'Create a bold, dynamic logo with an edgy mascot or icon for a gaming company. Use strong contrasts, energetic colors, and modern, aggressive typography. Emphasize speed, competition, and immersive experiences.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Pixel Vanguard',
      body: 'Conquer Every Realm',
      cta: 'Join Now'
    }
  },
  // --- BRAND IDENTITY Templates ---
  {
    id: 'identity-BI1-elegant-luxury',
    type: 'identity',
    visualStyle: 'elegant',
    industryKeywords: ['luxury', 'fashion', 'jewelry', 'boutique', 'high-end', 'premium'],
    promptHint: 'Render an elegant and sophisticated brand identity kit flat-lay. Feature a refined logomark, classic serif typography, and a subdued color palette with metallic accents. Include items like embossed business cards, letterhead, and product packaging, highlighting quality and exclusivity.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Eclat Couture',
      body: 'Redefining Opulence',
      cta: 'Discover Our Collection'
    }
  },
  {
    id: 'identity-BI2-playful-children',
    type: 'identity',
    visualStyle: 'playful',
    industryKeywords: ['children', 'kids', 'toys', 'education', 'play', 'family'],
    promptHint: 'Design a whimsical and colorful brand identity kit flat-lay for a children\'s brand. Use a cheerful logotype with rounded letters, playful illustrations, and a bright color scheme. Items include fun business cards, stickers, and product tags, emphasizing joy and creativity.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Curio Kids Club',
      body: 'Where Imagination Takes Flight',
      cta: 'Explore & Play'
    }
  },
  // --- SOCIAL MEDIA Templates ---
  {
    id: 'social-SM1-minimalist-business',
    type: 'social',
    visualStyle: 'minimalist',
    industryKeywords: ['corporate', 'business', 'consulting', 'finance', 'professional services'],
    promptHint: 'Create a clean, minimalist social media post template for a professional business. Use a neutral color palette with one accent color, clear sans-serif typography, and subtle geometric elements. Focus on a clear message with minimal clutter.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Elevate Your Strategy',
      body: 'Expert Insights for Growth',
      cta: 'Read Our Whitepaper'
    }
  },
  {
    id: 'social-SM2-bold-fitness',
    type: 'social',
    visualStyle: 'bold',
    industryKeywords: ['fitness', 'gym', 'health', 'wellness', 'sports', 'training'],
    promptHint: 'Design a bold, high-energy social media post template for a fitness brand. Use strong action imagery, vibrant colors, and impactful, distressed typography. Emphasize strength, motivation, and results.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Unleash Your Power',
      body: 'Transform Your Body, Mind, and Spirit',
      cta: 'Start Your Journey'
    }
  },
  // --- BROCHURE/CATALOG Templates ---
  // Brochure-Catalog-Landscape
  {
    id: 'brochure-BL1-futuristic-tech',
    type: 'brochure',
    visualStyle: 'futuristic',
    industryKeywords: ['tech', 'software', 'AI', 'robotics', 'innovation', 'future'],
    promptHint: 'Design a multi-page landscape brochure with a futuristic and sleek aesthetic. Incorporate glowing lines, abstract geometric patterns, and a dark theme. Use modern sans-serif fonts and clean data visualization elements. Emphasize innovation and advanced technology.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Pioneering Tomorrow\'s Solutions',
      body: 'Our advanced technological platforms are engineered to deliver unparalleled efficiency, driving your enterprise into a new era of digital excellence and innovation.',
      cta: 'Request a Live Demo'
    }
  },
  {
    id: 'brochure-BL2-elegant-travel',
    type: 'brochure',
    visualStyle: 'elegant',
    industryKeywords: ['travel', 'tourism', 'luxury resort', 'vacation', 'hospitality', 'destinations'],
    promptHint: 'Create an elegant landscape brochure for a luxury travel agency. Feature stunning photography of exotic destinations, sophisticated serif typography, and a spacious layout. Use a serene color palette with hints of gold, conveying relaxation and exclusivity.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Your Journey, Reimagined',
      body: 'Indulge in bespoke travel experiences meticulously crafted to inspire, enchant, and create indelible memories across the globe.',
      cta: 'Book Your Escape'
    }
  },
  // Brochure-Catalog-Portrait
  {
    id: 'brochure-BP1-minimalist-corporate',
    type: 'brochure',
    visualStyle: 'minimalist',
    industryKeywords: ['corporate', 'consulting', 'business', 'finance', 'legal'],
    promptHint: 'Design a clean, minimalist portrait brochure for a corporate consulting firm. Use a professional blue/grey color scheme, crisp sans-serif typography, and a structured layout with clear sections. Focus on conveying professionalism and clarity.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Strategic Partnership for Success',
      body: 'We provide tailored consulting services designed to optimize your operations, enhance market position, and drive sustainable business growth.',
      cta: 'Schedule a Consultation'
    }
  },
  {
    id: 'brochure-BP2-playful-education',
    type: 'brochure',
    visualStyle: 'playful',
    industryKeywords: ['education', 'school', 'university', 'learning', 'kids', 'youth'],
    promptHint: 'Create a vibrant, playful portrait brochure for an educational institution. Use a bright, inviting color palette, engaging illustrations, and fun, readable typography. Design for a young audience, emphasizing discovery and interactive learning.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Ignite a Passion for Learning',
      body: 'Our innovative programs and dedicated educators foster a dynamic environment where students thrive, explore, and achieve their fullest potential.',
      cta: 'Enroll Today'
    }
  },
  // Tri-Fold Flyer
  {
    id: 'brochure-TF1-bold-marketing',
    type: 'brochure',
    visualStyle: 'bold',
    industryKeywords: ['marketing', 'advertising', 'agency', 'promotion', 'sales'],
    promptHint: 'Design a bold and impactful tri-fold flyer for a marketing agency. Use strong visuals, contrasting colors, and energetic typography to grab attention. Structure clearly defined sections for services, benefits, and contact information.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Supercharge Your Brand',
      body: 'Unlock unparalleled visibility and engagement with our innovative marketing strategies, designed to connect you with your audience and drive measurable results.',
      cta: 'Get Your Free Audit'
    }
  },
  // --- WEB DESIGN Templates ---
  {
    id: 'web-W1-futuristic-software',
    type: 'web',
    visualStyle: 'futuristic',
    industryKeywords: ['software', 'cloud', 'AI', 'SaaS', 'platform', 'startup', 'web development'],
    promptHint: 'Design a responsive website layout with a futuristic, dark mode aesthetic. Incorporate glowing UI elements, abstract backgrounds, and modern sans-serif typography. Focus on clean data presentation, intuitive navigation, and engaging hero sections for a software product.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Next-Gen AI Platform',
      body: 'Empower your business with intelligent automation and data-driven insights, seamlessly integrated into your workflow for unprecedented efficiency.',
      cta: 'Start Free Trial'
    }
  },
  {
    id: 'web-W2-elegant-photography',
    type: 'web',
    visualStyle: 'elegant',
    industryKeywords: ['photography', 'art', 'portfolio', 'creative', 'gallery', 'artist'],
    promptHint: 'Create an elegant and minimalist website layout for a professional photography portfolio. Emphasize large, high-quality image displays, subtle hover effects, and sophisticated serif typography. Use a clean, monochromatic color scheme to let the visuals speak. Showcase work with grace and impact.',
    thumbnailUrl: '', 
    generatedContentExamples: {
      headline: 'Capturing Moments, Creating Art',
      body: 'Discover a curated collection of evocative imagery, each frame a testament to the beauty and emotion found in every moment.',
      cta: 'View Portfolio'
    }
  },
];


export const AdminDashboard: React.FC = () => {
  const [lang] = useState<Language>('en'); 
  const t = TRANSLATIONS[lang as Language];

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [designs, setDesigns] = useState<GeneratedDesignRecord[]>([]);
  const [conceptualTemplates, setConceptualTemplates] = useState<ConceptualTemplate[]>([]);

  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'designs' | 'templates'>('leads');

  const [searchEmail, setSearchEmail] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  // Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConceptualTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<Omit<ConceptualTemplate, 'industryKeywords' | 'generatedContentExamples'> & {
    industryKeywords: string, // For form input
    generatedContentExamples: string, // For form input
  }>({
    id: '',
    type: 'logo',
    visualStyle: 'minimalist',
    industryKeywords: '',
    promptHint: '',
    thumbnailUrl: '',
    generatedContentExamples: JSON.stringify({ headline: '', body: '', cta: '' }, null, 2),
  });
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);


  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      // Fetch data based on active tab
      if (activeTab === 'leads') {
        fetchLeads();
      } else if (activeTab === 'designs') {
        fetchDesigns();
      } else if (activeTab === 'templates') {
        fetchConceptualTemplates();
      }
    } else if (window.location.pathname === '/admin' && !isAuthenticated) {
      // If on admin route but not authenticated, ensure tabs don't try to load
      setActiveTab('leads'); 
    }
  }, [isAuthenticated, activeTab]); 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
        // On successful login, fetch data for the initial tab
        if (activeTab === 'leads') fetchLeads();
        else if (activeTab === 'designs') fetchDesigns();
        else if (activeTab === 'templates') fetchConceptualTemplates();
      } else {
        setLoginError(data.error || t.admin_invalid_credentials);
      }
    } catch (err) {
      console.error("Login failed:", err);
      setLoginError(t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const authenticatedFetch = async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setIsAuthenticated(false); // Force re-login if token is missing
      throw new Error("Authentication token not found.");
    }
    const headers = {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
      setIsAuthenticated(false); // Token expired or invalid
      localStorage.removeItem('adminToken');
      throw new Error("Authentication expired or invalid. Please log in again.");
    }
    return response;
  };

  const fetchLeads = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const response = await authenticatedFetch('/api/admin/leads');
      const data = await response.json();

      if (response.ok) {
        setLeads(data);
      } else {
        setDataError(data.error || t.error_generic);
      }
    } catch (err: any) {
      console.error("Failed to fetch leads:", err);
      setDataError(err.message || t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const fetchDesigns = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const queryParams = new URLSearchParams();
      if (searchEmail) queryParams.append('email', searchEmail);
      if (searchPhone) queryParams.append('phone', searchPhone);

      const response = await authenticatedFetch(`/api/admin/designs?${queryParams.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setDesigns(data);
      } else {
        setDataError(data.error || t.error_generic);
      }
    } catch (err: any) {
      console.error("Failed to fetch designs:", err);
      setDataError(err.message || t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const fetchConceptualTemplates = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const response = await authenticatedFetch('/api/admin/conceptual-templates');
      const data = await response.json();

      if (response.ok) {
        setConceptualTemplates(data);
      } else {
        setDataError(data.error || t.error_generic);
      }
    } catch (err: any) {
      console.error("Failed to fetch conceptual templates:", err);
      setDataError(err.message || t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setLeads([]);
    setDesigns([]);
    setConceptualTemplates([]);
    setLoginError(null);
    setDataError(null);
  };

  // --- Template Management Handlers ---
  const handleAddTemplate = () => {
    setEditingTemplate(null); // Clear any previous editing state
    setTemplateForm({
      id: '',
      type: 'logo',
      visualStyle: 'minimalist',
      industryKeywords: '',
      promptHint: '',
      thumbnailUrl: '',
      generatedContentExamples: JSON.stringify({ headline: '', body: '', cta: '' }, null, 2),
    });
    setTemplateFormError(null);
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template: ConceptualTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      ...template,
      industryKeywords: template.industryKeywords.join(', '),
      generatedContentExamples: JSON.stringify(template.generatedContentExamples, null, 2),
    });
    setTemplateFormError(null);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm(t.admin_template_delete_confirm)) {
      return;
    }
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/admin/conceptual-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t.error_generic);
      }
      await fetchConceptualTemplates(); // Refresh list
    } catch (err: any) {
      console.error("Failed to delete template:", err);
      setDataError(err.message || t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTemplateForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTemplateFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTemplateFormError(null);

    try {
      // Basic validation
      if (!templateForm.id || !templateForm.type || !templateForm.visualStyle || !templateForm.promptHint) {
        throw new Error("Please fill in all required template fields (ID, Type, Visual Style, Prompt Hint).");
      }
      try {
        JSON.parse(templateForm.generatedContentExamples);
      } catch {
        throw new Error("Generated Content Examples must be valid JSON.");
      }
      
      const payload: Omit<ConceptualTemplate, 'id'> & { id?: string } = {
        id: templateForm.id,
        type: templateForm.type,
        visualStyle: templateForm.visualStyle,
        industryKeywords: templateForm.industryKeywords.split(',').map(s => s.trim()).filter(s => s.length > 0),
        promptHint: templateForm.promptHint,
        thumbnailUrl: templateForm.thumbnailUrl || undefined,
        generatedContentExamples: JSON.parse(templateForm.generatedContentExamples),
      };

      if (editingTemplate) {
        // Update existing template
        const response = await authenticatedFetch(`/api/admin/conceptual-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t.error_generic);
        }
      } else {
        // Create new template
        const response = await authenticatedFetch('/api/admin/conceptual-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t.error_generic);
        }
      }
      setShowTemplateModal(false);
      await fetchConceptualTemplates(); // Refresh list
    } catch (err: any) {
      console.error("Failed to save template:", err);
      setTemplateFormError(err.message || t.error_generic);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-sans">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">{t.admin_login_title}</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">{t.admin_username}</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">{t.admin_password}</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                disabled={loading}
              />
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button 
              type="submit" 
              className="w-full bg-brand-green hover:bg-lime-500 text-black font-bold py-3 rounded-xl transition-colors"
              disabled={loading}
            >
              {loading ? 'Logging in...' : t.admin_login_btn}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="container mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-brand-green">
            {activeTab === 'leads' ? t.admin_leads_title : activeTab === 'designs' ? t.admin_designs_title : t.admin_tab_templates}
          </h1>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                if (activeTab === 'leads') fetchLeads();
                else if (activeTab === 'designs') fetchDesigns();
                else if (activeTab === 'templates') fetchConceptualTemplates();
              }} 
              className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Loading...' : t.admin_refresh}
            </button>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2 border border-red-900 text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
              disabled={loading}
            >
              {t.admin_logout}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 mb-6">
          <button 
            className={`py-2 px-4 text-lg font-medium ${activeTab === 'leads' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('leads')}
            disabled={loading}
          >
            {t.admin_tab_leads}
          </button>
          <button 
            className={`py-2 px-4 text-lg font-medium ${activeTab === 'designs' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('designs')}
            disabled={loading}
          >
            {t.admin_tab_designs}
          </button>
          <button 
            className={`py-2 px-4 text-lg font-medium ${activeTab === 'templates' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('templates')}
            disabled={loading}
          >
            {t.admin_tab_templates}
          </button>
        </div>

        {dataError && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-100 rounded-lg">
            <span>{dataError}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-green"></div>
          </div>
        ) : (
          <>
            {activeTab === 'leads' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                      <th className="p-4 font-semibold">{t.admin_col_date}</th>
                      <th className="p-4 font-semibold">{t.admin_col_name}</th>
                      <th className="p-4 font-semibold">{t.admin_col_company}</th>
                      <th className="p-4 font-semibold">{t.admin_col_email}</th>
                      <th className="p-4 font-semibold">{t.admin_col_phone}</th>
                      <th className="p-4 font-semibold">{t.admin_col_interest}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          {t.admin_no_leads}
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-medium">{lead.name}</td>
                          <td className="p-4 text-gray-300">{lead.company}</td>
                          <td className="p-4">
                            <a href={`mailto:${lead.email}`} className="text-brand-green hover:underline text-sm">
                              {lead.email}
                            </a>
                          </td>
                          <td className="p-4 text-gray-400 text-sm">{lead.phone}</td>
                          <td className="p-4 text-gray-300 text-sm">{lead.design_interest}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'designs' && (
              <>
                {/* Search / Filter for Designs */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4">
                  <input
                    type="email"
                    placeholder={t.admin_search_email}
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="flex-1 min-w-[200px] bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder={t.admin_search_phone}
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="flex-1 min-w-[200px] bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  />
                  <button 
                    onClick={fetchDesigns} 
                    className="px-4 py-2 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-500 transition-colors"
                    disabled={loading}
                  >
                    Search
                  </button>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                        <th className="p-4 font-semibold">{t.admin_col_date}</th>
                        <th className="p-4 font-semibold">{t.admin_col_design_type}</th>
                        <th className="p-4 font-semibold">{t.admin_col_business_name}</th>
                        <th className="p-4 font-semibold">{t.admin_col_email} / {t.admin_col_phone}</th>
                        <th className="p-4 font-semibold">{t.admin_col_image}</th>
                        <th className="p-4 font-semibold">{t.admin_col_template}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {designs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">
                            {t.admin_no_designs}
                          </td>
                        </tr>
                      ) : (
                        designs.map((design) => (
                          <tr key={design.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                              {new Date(design.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 font-medium capitalize text-sm">{design.design_type}</td>
                            <td className="p-4 text-gray-300 text-sm">{design.business_name}</td>
                            <td className="p-4 text-sm">
                              {design.contact_email && (
                                <a href={`mailto:${design.contact_email}`} className="text-brand-green hover:underline">
                                  {design.contact_email}
                                </a>
                              )}
                              {design.contact_email && design.contact_phone && <br/>}
                              {design.contact_phone && <span className="text-gray-400">{design.contact_phone}</span>}
                            </td>
                            <td className="p-4">
                              <img src={design.image_url} alt="Design Preview" className="w-20 h-20 object-contain rounded-md border border-gray-700" />
                            </td>
                            <td className="p-4">
                              {design.conceptual_template_id ? (
                                <span className="text-gray-300 text-sm">
                                  {design.conceptual_template_id}
                                </span>
                              ) : (
                                <span className="text-gray-500 text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'templates' && (
              <>
                <div className="flex justify-end mb-6">
                  <button 
                    onClick={handleAddTemplate}
                    className="px-4 py-2 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-500 transition-colors"
                  >
                    {t.admin_add_template}
                  </button>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                        <th className="p-4 font-semibold">{t.admin_col_id}</th>
                        <th className="p-4 font-semibold">{t.admin_col_type}</th>
                        <th className="p-4 font-semibold">{t.admin_col_style}</th>
                        <th className="p-4 font-semibold">{t.admin_col_keywords}</th>
                        <th className="p-4 font-semibold">{t.admin_col_prompt}</th>
                        <th className="p-4 font-semibold">{t.admin_col_thumbnail}</th>
                        <th className="p-4 font-semibold">{t.admin_col_examples}</th>
                        <th className="p-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {conceptualTemplates.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-500">
                            {t.admin_no_templates}
                          </td>
                        </tr>
                      ) : (
                        conceptualTemplates.map((template) => (
                          <tr key={template.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="p-4 text-gray-300 text-sm font-medium">{template.id}</td>
                            <td className="p-4 text-gray-400 text-sm capitalize">{template.type}</td>
                            <td className="p-4 text-gray-400 text-sm capitalize">{template.visualStyle}</td>
                            <td className="p-4 text-gray-400 text-xs">{template.industryKeywords.join(', ')}</td>
                            <td className="p-4 text-gray-400 text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">{template.promptHint}</td>
                            <td className="p-4">
                              {template.thumbnailUrl ? (
                                <img src={template.thumbnailUrl} alt="Thumbnail" className="w-16 h-12 object-contain rounded border border-gray-700" />
                              ) : (
                                <span className="text-gray-500 text-xs">No Image</span>
                              )}
                            </td>
                            <td className="p-4 text-gray-400 text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                              Headline: {template.generatedContentExamples.headline}, Body: {template.generatedContentExamples.body}, CTA: {template.generatedContentExamples.cta}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <button 
                                onClick={() => handleEditTemplate(template)}
                                className="text-blue-400 hover:text-blue-300 mr-3 text-sm"
                              >
                                {t.admin_edit_template}
                              </button>
                              <button 
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                {t.admin_delete_template}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Template Add/Edit Modal */}
                {showTemplateModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)} />
                    <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
                      <h2 className="text-2xl font-bold text-white mb-6 text-center">
                        {editingTemplate ? t.admin_template_form_title_edit : t.admin_template_form_title_add}
                      </h2>
                      
                      <form onSubmit={handleTemplateFormSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_id}</label>
                          <input 
                            type="text" 
                            name="id"
                            value={templateForm.id}
                            onChange={handleTemplateFormChange}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                            disabled={!!editingTemplate} // Disable ID edit for existing templates
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_type}</label>
                            <select 
                              name="type"
                              value={templateForm.type}
                              onChange={handleTemplateFormChange}
                              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                            >
                              {(['logo', 'identity', 'social', 'brochure', 'web'] as DesignType[]).map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_visual_style}</label>
                            <select 
                              name="visualStyle"
                              value={templateForm.visualStyle}
                              onChange={handleTemplateFormChange}
                              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                            >
                              {(['minimalist', 'bold', 'elegant', 'playful', 'futuristic'] as VisualStyle[]).map(style => (
                                <option key={style} value={style}>{style}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_industry_keywords}</label>
                          <input 
                            type="text" 
                            name="industryKeywords"
                            value={templateForm.industryKeywords}
                            onChange={handleTemplateFormChange}
                            placeholder="e.g. tech, software, finance"
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-1">Comma-separated values.</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_prompt_hint}</label>
                          <textarea 
                            name="promptHint"
                            value={templateForm.promptHint}
                            onChange={handleTemplateFormChange}
                            rows={4}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_thumbnail_url}</label>
                          <input 
                            type="text" 
                            name="thumbnailUrl"
                            value={templateForm.thumbnailUrl || ''}
                            onChange={handleTemplateFormChange}
                            placeholder="Direct URL for template image (e.g. from Google Drive)"
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                          />
                          {templateForm.thumbnailUrl && (
                            <img src={templateForm.thumbnailUrl} alt="Thumbnail Preview" className="mt-2 max-h-24 object-contain rounded border border-gray-700" />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_generated_content}</label>
                          <textarea 
                            name="generatedContentExamples"
                            value={templateForm.generatedContentExamples}
                            onChange={handleTemplateFormChange}
                            rows={6}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 font-mono text-white focus:border-brand-green focus:outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-1">JSON format: `{"headline": "...", "body": "...", "cta": "..."}`</p>
                        </div>
                        
                        {templateFormError && <p className="text-red-500 text-sm text-center">{templateFormError}</p>}

                        <div className="flex justify-end gap-4 mt-6">
                          <button 
                            type="button" 
                            onClick={() => setShowTemplateModal(false)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                          >
                            {t.admin_template_cancel}
                          </button>
                          <button 
                            type="submit"
                            className="px-4 py-2 bg-brand-green hover:bg-lime-500 text-black font-bold rounded-lg transition-colors"
                          >
                            {t.admin_template_save}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};