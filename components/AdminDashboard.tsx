import React, { useState, useEffect } from 'react';
import { LeadRecord, GeneratedDesignRecord, Language, ConceptualTemplate, DesignType, VisualStyle, GeneratedContentExamples, TemplateCategory, DesignTask, DesignTaskStatus } from '../types';
import { TRANSLATIONS, TEMPLATE_CATEGORIES } from '../constants';
import { triggerWebDesignGeneration } from '../services/geminiService'; // New import

interface AdminDashboardProps {
  PUBLIC_APP_URL: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ PUBLIC_APP_URL }) => {
  const [lang] = useState<Language>('en'); 
  const t = TRANSLATIONS[lang as Language];

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [designs, setDesigns] = useState<GeneratedDesignRecord[]>([]);
  const [conceptualTemplates, setConceptualTemplates] = useState<ConceptualTemplate[]>([]);
  const [designTasks, setDesignTasks] = useState<DesignTask[]>([]); // New state for Design Tasks

  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'designs' | 'templates' | 'design-tasks'>('leads'); // New tab

  const [searchEmail, setSearchEmail] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [filterTemplateCategory, setFilterTemplateCategory] = useState<TemplateCategory | 'all'>('all');
  const [filterDesignTaskStatus, setFilterDesignTaskStatus] = useState<DesignTaskStatus | 'all'>('all');


  // Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConceptualTemplate | null>(null);
  
  interface TemplateFormState extends Omit<ConceptualTemplate, 'industryKeywords' | 'generatedContentExamples'> {
    industryKeywords: string; // For form input
    generatedContentExamples: string; // For form input
  }

  const [templateForm, setTemplateForm] = useState<TemplateFormState>({
    id: '',
    type: 'logo',
    visualStyle: 'minimalist',
    category: 'logo', // Default category
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
      } else if (activeTab === 'design-tasks') { // New fetch for design tasks
        fetchDesignTasks();
      }
    } else if (window.location.pathname === '/admin' && !isAuthenticated) {
      // If on admin route but not authenticated, ensure tabs don't try to load
      setActiveTab('leads'); 
    }
  }, [isAuthenticated, activeTab, filterTemplateCategory, filterDesignTaskStatus]); // Added filterDesignTaskStatus

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
        else if (activeTab === 'design-tasks') fetchDesignTasks(); // New
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
      const queryParams = new URLSearchParams();
      if (filterTemplateCategory !== 'all') {
        queryParams.append('category', filterTemplateCategory);
      }
      
      const response = await authenticatedFetch(`/api/admin/conceptual-templates?${queryParams.toString()}`);
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

  const fetchDesignTasks = async () => {
    setLoading(true);
    setDataError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterDesignTaskStatus !== 'all') {
        queryParams.append('status', filterDesignTaskStatus);
      }

      const response = await authenticatedFetch(`/api/admin/design-tasks?${queryParams.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setDesignTasks(data);
      } else {
        setDataError(data.error || t.error_generic);
      }
    } catch (err: any) {
      console.error("Failed to fetch design tasks:", err);
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
    setDesignTasks([]); // Clear tasks
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
      category: 'logo', // Default category
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
      if (!templateForm.id || !templateForm.type || !templateForm.visualStyle || !templateForm.promptHint || !templateForm.category) {
        throw new Error("Please fill in all required template fields (ID, Type, Visual Style, Category, Prompt Hint).");
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
        category: templateForm.category, // Include category in payload
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

  // --- Design Task Handlers ---
  const handleTriggerWebDesignGeneration = async (taskId: number) => {
    if (!window.confirm("Are you sure you want to trigger AI generation for this website task? This will consume AI credits.")) {
      return;
    }
    setLoading(true);
    try {
      // Optimistic update
      setDesignTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'generating' } : task
      ));
      
      const result = await triggerWebDesignGeneration(taskId, (status) => console.log(`Task ${taskId} status: ${status}`));
      console.log("AI Generation Result:", result);
      await fetchDesignTasks(); // Refresh list to show completed status
    } catch (err: any) {
      console.error("Failed to trigger web design generation:", err);
      setDataError(err.message || t.error_generic);
      setDesignTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'failed' } : task // Revert status on error
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleViewGeneratedDesign = (designId: number) => {
    // Construct the direct link to the generated design on the public app
    const designLink = `${PUBLIC_APP_URL}#result-${designId}`; // Assuming App.tsx can handle hash routing for specific designs
    window.open(designLink, '_blank');
  };

  const handleExport = async (type: 'leads' | 'designs') => {
    setLoading(true);
    setDataError(null);
    try {
      const response = await authenticatedFetch(`/api/admin/${type}/export`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t.error_generic);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error(`Failed to export ${type}:`, err);
      setDataError(err.message || t.error_generic);
    } finally {
      setLoading(false);
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
            {activeTab === 'leads' ? t.admin_leads_title : 
             activeTab === 'designs' ? t.admin_designs_title : 
             activeTab === 'templates' ? t.admin_tab_templates : 
             t.admin_tab_design_tasks}
          </h1>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                if (activeTab === 'leads') fetchLeads();
                else if (activeTab === 'designs') fetchDesigns();
                else if (activeTab === 'templates') fetchConceptualTemplates();
                else if (activeTab === 'design-tasks') fetchDesignTasks();
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
          <button 
            className={`py-2 px-4 text-lg font-medium ${activeTab === 'design-tasks' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('design-tasks')}
            disabled={loading}
          >
            {t.admin_tab_design_tasks}
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
              <>
                 <div className="flex justify-end mb-4">
                    <button 
                       onClick={() => handleExport('leads')}
                       className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors"
                       disabled={loading || leads.length === 0}
                    >
                       {t.admin_export_leads}
                    </button>
                 </div>
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
                          <td className="p-4 text-gray-300 text-sm capitalize">{t[lead.design_interest as keyof typeof t] as string || lead.design_interest}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {activeTab === 'designs' && (
              <>
                {/* Search / Filter for Designs */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
                  <input
                    type="email"
                    placeholder={t.admin_search_email}
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="flex-1 min-w-[180px] bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder={t.admin_search_phone}
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="flex-1 min-w-[180px] bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  />
                  <button 
                    onClick={fetchDesigns} 
                    className="px-4 py-2 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-500 transition-colors"
                    disabled={loading}
                  >
                    Search
                  </button>
                  <button 
                     onClick={() => handleExport('designs')}
                     className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors"
                     disabled={loading || designs.length === 0}
                  >
                     {t.admin_export_designs}
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
                <div className="flex justify-between items-center mb-6">
                  <select
                    value={filterTemplateCategory}
                    onChange={(e) => setFilterTemplateCategory(e.target.value as TemplateCategory | 'all')}
                    className="bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{t[cat as keyof typeof t] as string}</option>
                    ))}
                  </select>

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
                        <th className="p-4 font-semibold">{t.admin_col_category}</th> {/* New column */}
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
                          <td colSpan={9} className="p-8 text-center text-gray-500">
                            {t.admin_no_templates}
                          </td>
                        </tr>
                      ) : (
                        conceptualTemplates.map((template) => (
                          <tr key={template.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="p-4 text-gray-300 text-sm font-medium">{template.id}</td>
                            <td className="p-4 text-gray-400 text-sm capitalize">{template.type}</td>
                            <td className="p-4 text-gray-400 text-sm capitalize">{template.visualStyle}</td>
                            <td className="p-4 text-gray-400 text-sm capitalize">{t[template.category as keyof typeof t] as string}</td> {/* Display category */}
                            <td className="p-4 text-gray-400 text-xs">{template.industryKeywords.join(', ')}</td>
                            <td className="p-4 text-gray-400 text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">{template.promptHint}</td>
                            <td className="p-4">
                              {template.thumbnailUrl ? (
                                <img src={template.thumbnailUrl} alt="Thumbnail" className="w-16 h-12 object-contain rounded-md border border-gray-700" />
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
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t.admin_template_category}</label>
                            <select 
                              name="category"
                              value={templateForm.category}
                              onChange={handleTemplateFormChange}
                              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white focus:border-brand-green focus:outline-none"
                            >
                              {TEMPLATE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{t[cat as keyof typeof t] as string}</option>
                              ))}
                            </select>
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

            {activeTab === 'design-tasks' && ( // New tab for Design Tasks
              <>
                <div className="flex justify-between items-center mb-6">
                  <select
                    value={filterDesignTaskStatus}
                    onChange={(e) => setFilterDesignTaskStatus(e.target.value as DesignTaskStatus | 'all')}
                    className="bg-black/50 border border-gray-700 rounded-lg p-2 text-white focus:border-brand-green focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">{t.task_status_pending}</option>
                    <option value="generating">{t.task_status_generating}</option>
                    <option value="completed">{t.task_status_completed}</option>
                    <option value="failed">{t.task_status_failed}</option>
                    <option value="cancelled">{t.task_status_cancelled}</option>
                  </select>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                        <th className="p-4 font-semibold">{t.admin_col_id}</th>
                        <th className="p-4 font-semibold">{t.admin_col_requested_at}</th>
                        <th className="p-4 font-semibold">{t.admin_col_contact_info}</th>
                        <th className="p-4 font-semibold">{t.admin_col_request_type}</th>
                        <th className="p-4 font-semibold">{t.admin_col_business_details}</th>
                        <th className="p-4 font-semibold">{t.admin_col_status}</th>
                        <th className="p-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {designTasks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-500">
                            {t.admin_no_design_tasks}
                          </td>
                        </tr>
                      ) : (
                        designTasks.map((task) => (
                          <tr key={task.id} className="hover:bg-gray-800/50 transition-colors">
                            <td className="p-4 text-gray-300 text-sm font-medium">{task.id}</td>
                            <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                              {new Date(task.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-sm">
                              <p className="font-medium">{task.contact_name}</p>
                              <a href={`mailto:${task.contact_email}`} className="text-brand-green hover:underline">
                                {task.contact_email}
                              </a>
                              <p className="text-gray-400">{task.contact_phone}</p>
                            </td>
                            <td className="p-4 text-sm capitalize">{t[task.design_type as keyof typeof t] as string}</td>
                            <td className="p-4 text-gray-300 text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                              {/* Parse business_data JSON to display relevant info */}
                              {(() => {
                                try {
                                  const bd = JSON.parse(task.business_data);
                                  return (
                                    <>
                                      <p className="font-medium">{bd.name}</p>
                                      <p>{bd.industry}</p>
                                      <p>{bd.description}</p>
                                    </>
                                  );
                                } catch {
                                  return task.business_data;
                                }
                              })()}
                            </td>
                            <td className="p-4 text-sm whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                                ${task.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                                  task.status === 'generating' ? 'bg-blue-900 text-blue-300' :
                                  task.status === 'completed' ? 'bg-green-900 text-green-300' :
                                  'bg-red-900 text-red-300'}`}>
                                {t[`task_status_${task.status}` as keyof typeof t] as string}
                              </span>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              {task.status === 'pending' && (
                                <button 
                                  onClick={() => handleTriggerWebDesignGeneration(task.id)}
                                  className="px-3 py-1 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-500 transition-colors text-xs"
                                  disabled={loading}
                                >
                                  {loading ? 'Processing...' : t.admin_action_generate}
                                </button>
                              )}
                              {task.status === 'completed' && task.generated_design_id && (
                                <button 
                                  onClick={() => handleViewGeneratedDesign(task.generated_design_id!)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-xs"
                                  disabled={loading}
                                >
                                  {t.admin_action_view_design}
                                </button>
                              )}
                              {(task.status === 'failed' || task.status === 'cancelled') && (
                                <span className="text-gray-500 text-xs">{t[`task_status_${task.status}` as keyof typeof t] as string}</span>
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
          </>
        )}
      </div>
    </div>
  );
};