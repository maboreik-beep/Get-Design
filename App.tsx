
import React, { useState, useEffect, useRef } from 'react'; 
import { 
  DesignType, 
  BusinessData, 
  GeneratedResult, 
  ContactDetails, 
  Language,
  VisualStyle,
  InputMode,
  Template,
} from './types';
import { TRANSLATIONS, WEBSITE_PAGES, SUPPORT_NUMBER, GENERIC_WEB_DRAFT_SVG_DATA_URL } from './constants';
import { generateDesign, fetchDesignStatus } from './services/geminiService'; 
import { Logo } from './components/Logo';
import { FileUpload } from './components/FileUpload';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  // --- State ---
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Language
  const [lang, setLang] = useState<Language>('en');
  const t = TRANSLATIONS[lang];
  const isRTL = lang === 'ar';

  // Navigation / Flow
  const [step, setStep] = useState<'category-selection' | 'type-selection' | 'template-selection' | 'input-form' | 'generating' | 'result'>('category-selection');
  const [category, setCategory] = useState<'graphics' | 'web' | null>(null);
  const [designType, setDesignType] = useState<DesignType>('logo');
  
  // Loading Status
  const [loadingStatus, setLoadingStatus] = useState("");

  // Input Mode
  const [inputMode, setInputMode] = useState<InputMode>('form'); 

  // Data
  const [businessData, setBusinessData] = useState<BusinessData>({
    name: '',
    industry: '',
    description: '',
    selectedPages: [],
    brochureOrientation: 'portrait',
    brochurePageCount: 4,
    brochureSize: 'a4',
    logoStyle: '3d', 
    socialPlatform: 'instagram', 
    customColorPalette: '', 
    visualStyle: 'minimalist', 
    postContent: '',
    templateId: undefined
  });

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Uploads
  const [logoBase64, setLogoBase64] = useState<string | null>(null); 
  const [brochureBase64, setBrochureBase64] = useState<string[] | null>(null); 
  const [zipFile, setZipFile] = useState<File | null>(null); 

  // Results & History
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [history, setHistory] = useState<GeneratedResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Carousel State (Web/Brochure)
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Contact Modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactDetails, setContactDetails] = useState<ContactDetails>({
    name: '',
    company: '',
    email: '',
    phone: ''
  });
  
  // Validation State
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof ContactDetails, string>>>({});
  
  // UI State
  const [error, setError] = useState<string | null>(null);

  // Polling ref for web drafts
  const draftPollingIntervalRef = useRef<number | null>(null);

  // Define loadFromHistory helper
  const loadFromHistory = (design: GeneratedResult) => {
    setGeneratedResult(design);
    setStep('result');
    setCurrentImageIndex(0);
  };

  // --- Effects ---
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('design_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedContact = localStorage.getItem('contact_details');
      if (savedContact) {
        setContactDetails(JSON.parse(savedContact));
      }
    } catch (e) {
      console.warn("Failed to load local storage data or storage is empty", e);
    }

    if (window.location.pathname === '/admin') {
      setIsAdmin(true);
    }
    
    // Fetch Templates
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (e) { console.error("Failed to fetch templates", e); }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#result-')) {
        const designId = hash.substring('#result-'.length);
        const foundDesign = history.find(d => d.id === designId);
        if (foundDesign) {
          loadFromHistory(foundDesign);
        } else {
          setStep('category-selection'); 
          setCategory(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [history]); 

  // Effect for polling web drafts
  useEffect(() => {
    if (draftPollingIntervalRef.current) {
      clearInterval(draftPollingIntervalRef.current);
    }

    const webPendingDrafts = history.filter(item => 
      item.type === 'web' && 
      (item.status === 'initial_draft_placeholder' || item.status === 'ai_draft_generated')
    );

    if (webPendingDrafts.length > 0) {
      // @ts-ignore
      draftPollingIntervalRef.current = setInterval(async () => {
        for (const draft of webPendingDrafts) {
          if (draft.designTaskId && (draft.status === 'initial_draft_placeholder' || draft.status === 'ai_draft_generated')) {
            try {
              const { imageUrl, status } = await fetchDesignStatus(draft.id as unknown as number);
              if (status !== draft.status || imageUrl !== draft.imageUrl) {
                 const updatedHistory = history.map(h => 
                    h.id === draft.id ? { ...h, status, imageUrl } : h
                 );
                 setHistory(updatedHistory);
                 localStorage.setItem('design_history', JSON.stringify(updatedHistory));

                 // Update current view if viewing this design
                 if (generatedResult && generatedResult.id === draft.id) {
                    setGeneratedResult(prev => prev ? { ...prev, status, imageUrl } : null);
                 }
              }
            } catch (e) {
               console.error("Polling error", e);
            }
          }
        }
      }, 5000);
    }

    return () => {
      if (draftPollingIntervalRef.current) {
        clearInterval(draftPollingIntervalRef.current);
      }
    };
  }, [history, generatedResult]);

  // --- Handlers ---
  const handleInputChange = (field: keyof BusinessData, value: any) => {
    setBusinessData(prev => ({ ...prev, [field]: value }));
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setBusinessData(prev => ({ ...prev, templateId: template.id }));
    setStep('input-form');
  };

  const validateContact = () => {
    const errors: any = {};
    if (!contactDetails.name) errors.name = t.validation_name_req;
    if (!contactDetails.company) errors.company = t.validation_company_req;
    if (!contactDetails.email) errors.email = t.validation_email_req;
    if (!contactDetails.phone) errors.phone = t.validation_phone_req;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContactSubmit = async () => {
    if (!validateContact()) return;
    
    // Save contact
    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              ...contactDetails,
              design_interest: designType // Pass design type as interest
            })
        });
        
        if (!res.ok) throw new Error("Failed to save contact");
        
        const data = await res.json();
        const contactId = data.id;
        
        localStorage.setItem('contact_details', JSON.stringify(contactDetails));
        setShowContactModal(false);
        startGeneration(contactId);

    } catch (e) {
        console.error("Contact submit error:", e);
        setError(t.error_generic);
        setShowContactModal(false); // Close modal to show error on main screen
    }
  };

  const startGeneration = async (contactId?: number) => {
    setStep('generating');
    setLoadingStatus(t.generating);
    setError(null);

    try {
        const finalData = { ...businessData, contactId };
        
        const result = await generateDesign(
            designType,
            inputMode,
            finalData,
            logoBase64,
            setLoadingStatus,
            zipFile
        );

        setGeneratedResult(result);
        setHistory(prev => {
            const newHistory = [result, ...prev];
            localStorage.setItem('design_history', JSON.stringify(newHistory));
            return newHistory;
        });
        setStep('result');
        setCurrentImageIndex(0);

    } catch (err: any) {
        console.error(err);
        setError(err.message || t.error_generic);
        setStep('input-form');
    }
  };

  const initiateGeneration = () => {
    // Validate Business Data
    if (!businessData.name) {
        alert("Business Name is required");
        return;
    }
    setShowContactModal(true);
  };

  // Filter templates based on category or type mapping
  const relevantTemplates = templates.filter(t => {
      if (category === 'web') return t.category === 'website_design';
      if (designType === 'logo') return t.category === 'logo';
      if (designType === 'social') return t.category === 'social_media';
      if (designType === 'brochure') return t.category.includes('brochure') || t.category.includes('flyer');
      return true;
  });

  // --- Render ---
  if (isAdmin) {
    return <AdminDashboard PUBLIC_APP_URL={process.env.PUBLIC_APP_URL || ''} />;
  }

  return (
    <div className={`min-h-screen bg-black text-white font-sans ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-center">
        <Logo />
        <div className="flex gap-4">
            <button onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')} className="text-sm font-bold bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-full transition-colors border border-gray-700">
                {lang === 'en' ? '🇨🇦 EN' : '🇸🇦 AR'}
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="text-sm font-bold bg-brand-green text-black px-4 py-1 rounded-full hover:bg-opacity-90 transition-colors">
                {t.my_creations}
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 pt-24 pb-12 min-h-screen flex flex-col items-center justify-center relative">
        
        {/* Error Display */}
        {error && (
            <div className="absolute top-24 z-50 animate-fade-in bg-red-900/80 border border-red-500 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md max-w-md text-center">
                <p className="font-bold mb-1">⚠️ Error</p>
                <p className="text-sm opacity-90">{error}</p>
                <button onClick={() => setError(null)} className="mt-2 text-xs underline hover:text-white">Dismiss</button>
            </div>
        )}

        {/* History Sidebar/Drawer */}
        {showHistory && (
            <div className="absolute top-20 right-4 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-4 z-30 max-h-[80vh] overflow-y-auto">
                <h3 className="text-brand-green font-bold mb-4">{t.my_creations}</h3>
                {history.length === 0 ? <p className="text-gray-500 text-sm">{t.no_creations}</p> : (
                    <div className="space-y-3">
                        {history.map(item => (
                            <div key={item.id} onClick={() => loadFromHistory(item)} className="cursor-pointer bg-black/50 p-2 rounded hover:border-brand-green border border-transparent transition-all flex gap-3 items-center">
                                <img src={item.imageUrl} className="w-12 h-12 object-cover rounded bg-white" alt="Thumbnail" />
                                <div className="overflow-hidden">
                                    <p className="font-bold text-sm truncate">{item.data.name}</p>
                                    <p className="text-xs text-gray-500">{item.type} - {new Date(Number(item.id)).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Step 1: Category Selection */}
        {step === 'category-selection' && (
            <div className="text-center animate-fade-in max-w-2xl w-full">
                <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">{t.title}</h1>
                <p className="text-xl text-gray-400 mb-12">{t.subtitle}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => { setCategory('graphics'); setStep('type-selection'); }} className="group relative overflow-hidden bg-gray-900 border border-gray-800 hover:border-brand-green rounded-2xl p-8 transition-all duration-300">
                        <div className="absolute inset-0 bg-brand-green/5 group-hover:bg-brand-green/10 transition-colors"></div>
                        <h3 className="text-2xl font-bold mb-2 group-hover:text-brand-green transition-colors">{t.cat_graphics}</h3>
                        <p className="text-gray-500">Logos, Social Media, Brochures</p>
                    </button>
                    <button onClick={() => { setCategory('web'); setDesignType('web'); setStep('template-selection'); }} className="group relative overflow-hidden bg-gray-900 border border-gray-800 hover:border-brand-green rounded-2xl p-8 transition-all duration-300">
                        <div className="absolute inset-0 bg-brand-green/5 group-hover:bg-brand-green/10 transition-colors"></div>
                        <h3 className="text-2xl font-bold mb-2 group-hover:text-brand-green transition-colors">{t.cat_web}</h3>
                        <p className="text-gray-500">Landing Pages, Websites</p>
                    </button>
                </div>
            </div>
        )}

        {/* Step 2: Type Selection */}
        {step === 'type-selection' && (
            <div className="text-center animate-fade-in w-full max-w-4xl">
                 <button onClick={() => setStep('category-selection')} className="mb-8 text-gray-500 hover:text-white flex items-center gap-2 mx-auto">← {t.back_to_menu}</button>
                 <h2 className="text-3xl font-bold mb-8">{t.select_type}</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { id: 'logo', label: t.type_logo, icon: '🎨' },
                        { id: 'identity', label: t.type_identity, icon: '🆔' },
                        { id: 'social', label: t.type_social, icon: '📱' },
                        { id: 'brochure', label: t.type_brochure, icon: '📄' },
                    ].map(type => (
                        <button key={type.id} onClick={() => { setDesignType(type.id as DesignType); setStep('template-selection'); }} className="bg-gray-900 border border-gray-800 p-6 rounded-xl hover:bg-gray-800 hover:border-brand-green transition-all">
                            <div className="text-4xl mb-4">{type.icon}</div>
                            <div className="font-bold">{type.label}</div>
                        </button>
                    ))}
                 </div>
            </div>
        )}

        {/* Step 3: Template Selection (Restored) */}
        {step === 'template-selection' && (
            <div className="w-full max-w-6xl animate-fade-in">
                <button onClick={() => setStep(category === 'web' ? 'category-selection' : 'type-selection')} className="mb-6 text-gray-500 hover:text-white flex items-center gap-2">← Back</button>
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-2">Choose a Reference Style</h2>
                    <p className="text-gray-400">Select a style to inspire the AI generator.</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Default Option: No Template */}
                    <button 
                        onClick={() => { setSelectedTemplate(null); setBusinessData(prev => ({...prev, templateId: undefined})); setStep('input-form'); }}
                        className="aspect-square bg-gray-900 border-2 border-gray-700 hover:border-brand-green rounded-xl p-6 flex flex-col items-center justify-center transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-brand-green group-hover:text-black transition-colors">
                            ✨
                        </div>
                        <span className="font-bold">Start from Scratch</span>
                    </button>

                    {/* Render Templates */}
                    {relevantTemplates.map(tpl => (
                         <button 
                            key={tpl.id}
                            onClick={() => handleTemplateSelect(tpl)}
                            className="aspect-square relative group rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-green transition-all"
                         >
                            <img src={tpl.thumbnail_url || tpl.url} alt={tpl.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col p-4">
                                <p className="font-bold text-white mb-2">{tpl.title}</p>
                                <span className="text-xs bg-brand-green text-black px-2 py-1 rounded">Select Style</span>
                            </div>
                         </button>
                    ))}
                </div>
            </div>
        )}

        {/* Step 4: Input Form */}
        {step === 'input-form' && (
            <div className="w-full max-w-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => setStep('template-selection')} className="text-gray-500 hover:text-white">← Back</button>
                    <div className="flex gap-2 bg-gray-900 p-1 rounded-lg">
                        <button onClick={() => setInputMode('form')} className={`px-4 py-1 rounded text-sm ${inputMode === 'form' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>{t.mode_form_input}</button>
                        <button onClick={() => setInputMode('zip')} className={`px-4 py-1 rounded text-sm ${inputMode === 'zip' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>{t.mode_zip_upload}</button>
                    </div>
                </div>

                <div className="bg-gray-900/50 backdrop-blur border border-gray-800 p-8 rounded-2xl space-y-6">
                    {inputMode === 'zip' ? (
                        <FileUpload<File> 
                            label={t.upload_zip_label} 
                            accept=".zip" 
                            onFileSelect={(f) => {
                                if (!Array.isArray(f)) setZipFile(f);
                            }} 
                            returnFileObject={true} 
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">{t.input_name}</label>
                                    <input type="text" value={businessData.name} onChange={e => handleInputChange('name', e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-brand-green outline-none transition-colors" placeholder={t.placeholder_name} />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">{t.input_industry}</label>
                                    <input type="text" value={businessData.industry} onChange={e => handleInputChange('industry', e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-brand-green outline-none transition-colors" placeholder={t.placeholder_industry} />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">{t.input_description}</label>
                                <textarea value={businessData.description} onChange={e => handleInputChange('description', e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 h-24 focus:border-brand-green outline-none transition-colors" placeholder={t.placeholder_description} />
                            </div>

                            {/* Dynamic Fields based on Type */}
                            {designType === 'logo' && (
                                <FileUpload 
                                    label={t.upload_label} 
                                    onFileSelect={(f) => {
                                        if (!Array.isArray(f)) setLogoBase64(f);
                                    }} 
                                />
                            )}
                            
                            {(designType === 'brochure' || designType === 'web') && (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Color Palette</label>
                                    <input type="text" value={businessData.customColorPalette} onChange={e => handleInputChange('customColorPalette', e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 focus:border-brand-green outline-none" placeholder={t.placeholder_custom_colors} />
                                </div>
                            )}

                             {designType === 'brochure' && (
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-xs text-gray-400 mb-1">{t.input_orientation}</label>
                                        <select value={businessData.brochureOrientation} onChange={e => handleInputChange('brochureOrientation', e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white">
                                            <option value="portrait">{t.orientation_portrait}</option>
                                            <option value="landscape">{t.orientation_landscape}</option>
                                        </select>
                                     </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">{t.input_size}</label>
                                        <select value={businessData.brochureSize} onChange={e => handleInputChange('brochureSize', e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white">
                                            <option value="a4">{t.size_a4}</option>
                                            <option value="a5">{t.size_a5}</option>
                                            <option value="folded">{t.size_folded}</option>
                                        </select>
                                     </div>
                                </div>
                             )}
                             
                             {/* Show Selected Template info if any */}
                             {selectedTemplate && (
                                 <div className="bg-black/30 p-4 rounded border border-gray-700 flex items-center gap-4">
                                     <img src={selectedTemplate.thumbnail_url || selectedTemplate.url} className="w-12 h-12 rounded object-cover" alt="Selected" />
                                     <div>
                                         <p className="text-sm font-bold text-gray-300">Style Reference Selected</p>
                                         <p className="text-xs text-brand-green">{selectedTemplate.title}</p>
                                     </div>
                                     <button onClick={() => { setSelectedTemplate(null); setBusinessData(prev => ({...prev, templateId: undefined})); }} className="ml-auto text-xs text-red-400 hover:text-red-300">Remove</button>
                                 </div>
                             )}

                        </>
                    )}

                    <button onClick={initiateGeneration} className="w-full bg-brand-green hover:bg-white hover:scale-[1.02] text-black font-bold py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(123,193,67,0.3)]">
                        {t.generate_btn}
                    </button>
                </div>
            </div>
        )}

        {/* Step 5: Generating */}
        {step === 'generating' && (
            <div className="text-center animate-fade-in">
                <div className="w-24 h-24 border-4 border-gray-800 border-t-brand-green rounded-full animate-spin mx-auto mb-8"></div>
                <h2 className="text-2xl font-bold mb-4">{t.generating}</h2>
                <p className="text-gray-400 animate-pulse">{loadingStatus}</p>
            </div>
        )}

        {/* Step 6: Result */}
        {step === 'result' && generatedResult && (
            <div className="w-full max-w-6xl animate-fade-in flex flex-col md:flex-row gap-8">
                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-center min-h-[500px] relative">
                    <img src={generatedResult.imageUrl} className="max-w-full max-h-[80vh] shadow-2xl rounded" alt="Generated Design" />
                    {generatedResult.status === 'initial_draft_placeholder' && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center flex-col p-6 text-center">
                            <p className="text-xl font-bold mb-2 text-brand-green">{t.web_design_pending_message}</p>
                        </div>
                    )}
                </div>
                <div className="w-full md:w-80 space-y-4">
                     <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                        <h3 className="font-bold mb-4 text-brand-green">Details</h3>
                        <p className="text-sm text-gray-400 mb-1">Project</p>
                        <p className="mb-4">{generatedResult.data.name}</p>
                        <p className="text-sm text-gray-400 mb-1">Type</p>
                        <p className="mb-4 capitalize">{generatedResult.type}</p>
                        <div className="h-px bg-gray-800 my-4"></div>
                        <button onClick={() => {
                            const link = document.createElement('a');
                            link.href = generatedResult.imageUrl;
                            link.download = `${generatedResult.data.name}-design.svg`;
                            link.click();
                        }} className="w-full bg-white text-black font-bold py-3 rounded-lg mb-2 hover:bg-gray-200">{t.download_btn}</button>
                        <button onClick={() => setStep('category-selection')} className="w-full border border-gray-700 text-gray-400 py-3 rounded-lg hover:text-white hover:border-gray-500">{t.load_design}</button>
                     </div>
                </div>
            </div>
        )}

        {/* Contact Modal */}
        {showContactModal && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full animate-scale-in">
                    <h2 className="text-2xl font-bold mb-2">{t.contact_modal_title}</h2>
                    <p className="text-gray-400 mb-6">{t.contact_modal_subtitle}</p>
                    <div className="space-y-4">
                        <input value={contactDetails.name} onChange={e=>setContactDetails({...contactDetails, name: e.target.value})} placeholder={t.contact_name} className={`w-full bg-black border ${validationErrors.name ? 'border-red-500' : 'border-gray-700'} rounded p-3`} />
                        {validationErrors.name && <p className="text-red-500 text-xs">{validationErrors.name}</p>}
                        
                        <input value={contactDetails.company} onChange={e=>setContactDetails({...contactDetails, company: e.target.value})} placeholder={t.contact_company} className={`w-full bg-black border ${validationErrors.company ? 'border-red-500' : 'border-gray-700'} rounded p-3`} />
                         {validationErrors.company && <p className="text-red-500 text-xs">{validationErrors.company}</p>}

                        <input value={contactDetails.email} onChange={e=>setContactDetails({...contactDetails, email: e.target.value})} placeholder={t.contact_email} className={`w-full bg-black border ${validationErrors.email ? 'border-red-500' : 'border-gray-700'} rounded p-3`} />
                         {validationErrors.email && <p className="text-red-500 text-xs">{validationErrors.email}</p>}

                        <input value={contactDetails.phone} onChange={e=>setContactDetails({...contactDetails, phone: e.target.value})} placeholder={t.contact_phone} className={`w-full bg-black border ${validationErrors.phone ? 'border-red-500' : 'border-gray-700'} rounded p-3`} />
                         {validationErrors.phone && <p className="text-red-500 text-xs">{validationErrors.phone}</p>}

                        <button onClick={handleContactSubmit} className="w-full bg-brand-green text-black font-bold py-3 rounded hover:bg-white transition-colors">{t.contact_submit}</button>
                        <button onClick={() => setShowContactModal(false)} className="w-full text-gray-500 mt-2 hover:text-white">Cancel</button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
