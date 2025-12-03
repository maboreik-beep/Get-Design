import React, { useState, useEffect } from 'react'; 
import { 
  DesignType, 
  BusinessData, 
  GeneratedResult, 
  ContactDetails, 
  Language,
  InputMode,
  VisualStyle
} from './types';
import { TRANSLATIONS } from './constants';
import { generateDesign } from './services/geminiService'; 
import { Logo } from './components/Logo';
import { AdminDashboard } from './components/AdminDashboard';

// --- VISUAL ASSETS (SVG Components) ---

const Icons = {
    // Styles
    Lightning: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
    ),
    Building: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="22" x2="12" y2="22.01"></line><line x1="12" y1="2" x2="12" y2="4"></line><line x1="4" y1="10" x2="20" y2="10"></line><line x1="4" y1="14" x2="20" y2="14"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
    ),
    Film: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
    ),
    Bag: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
    ),
    // Categories
    Image: () => (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
    ),
    Monitor: () => (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
    ),
    // Arrows
    Back: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    ),
    Upload: () => (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
    )
};

const DEFAULT_STYLES: { id: VisualStyle, label: string, Icon: React.FC<any> }[] = [
  { id: 'minimalist', label: 'SaaS / Startup', Icon: Icons.Lightning },
  { id: 'bold', label: 'Corporate', Icon: Icons.Building }, 
  { id: 'playful', label: 'Creative / Bold', Icon: Icons.Film },
  { id: 'elegant', label: 'E-Commerce', Icon: Icons.Bag },
];

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const t = TRANSLATIONS[lang];
  const isRTL = lang === 'ar';

  const [step, setStep] = useState<'category-selection' | 'type-selection' | 'input-form' | 'generating' | 'result'>('category-selection');
  const [category, setCategory] = useState<'graphics' | 'web' | null>(null);
  const [designType, setDesignType] = useState<DesignType>('logo');
  const [loadingStatus, setLoadingStatus] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>('form'); 

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

  const [logoBase64, setLogoBase64] = useState<string | null>(null); 
  const [zipFile, setZipFile] = useState<File | null>(null); 
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [history, setHistory] = useState<GeneratedResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactDetails, setContactDetails] = useState<ContactDetails>({ name: '', company: '', email: '', phone: '' });
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof ContactDetails, string>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('design_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      const savedContact = localStorage.getItem('contact_details');
      if (savedContact) setContactDetails(JSON.parse(savedContact));
    } catch (e) {}

    if (window.location.pathname === '/admin') setIsAdmin(true);
  }, []);

  const loadFromHistory = (design: GeneratedResult) => {
    setGeneratedResult(design);
    setStep('result');
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

    } catch (err: any) {
        console.error(err);
        setError(err.message || t.error_generic);
        setStep('input-form');
    }
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
    
    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ...contactDetails, design_interest: designType })
        });
        
        let contactId;
        if (res.ok) {
           const data = await res.json();
           contactId = data.id;
        }
        
        localStorage.setItem('contact_details', JSON.stringify(contactDetails));
        setShowContactModal(false);
        setTimeout(() => startGeneration(contactId), 100);

    } catch (e) {
        console.error("Contact submit error:", e);
        setShowContactModal(false);
        startGeneration();
    }
  };

  if (isAdmin) return <AdminDashboard PUBLIC_APP_URL={process.env.PUBLIC_APP_URL || ''} />;

  return (
    <div className={`min-h-screen bg-black text-white font-sans ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-center">
        <Logo />
        <div className="flex gap-4">
            <button onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')} className="text-sm font-bold bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-full border border-gray-700 transition-colors">{lang === 'en' ? '🇨🇦 EN' : '🇸🇦 AR'}</button>
            <button onClick={() => setShowHistory(!showHistory)} className="text-sm font-bold bg-brand-green text-black px-4 py-1 rounded-full hover:bg-opacity-90 transition-colors">{t.my_creations}</button>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-24 pb-12 min-h-screen flex flex-col items-center justify-center relative">
        {error && (
            <div className="absolute top-24 z-50 bg-red-900/80 border border-red-500 text-white px-6 py-4 rounded-xl backdrop-blur-md max-w-md text-center">
                <p className="font-bold mb-1">⚠️ Error</p>
                <p className="text-sm opacity-90">{error}</p>
                <button onClick={() => setError(null)} className="mt-2 text-xs underline hover:text-white">Dismiss</button>
            </div>
        )}

        {showHistory && (
            <div className="absolute top-20 right-4 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-4 z-30 max-h-[80vh] overflow-y-auto">
                <h3 className="text-brand-green font-bold mb-4">{t.my_creations}</h3>
                {history.length === 0 ? <p className="text-gray-500 text-sm">{t.no_creations}</p> : (
                    <div className="space-y-3">
                        {history.map(item => (
                            <div key={item.id} onClick={() => loadFromHistory(item)} className="cursor-pointer bg-black/50 p-2 rounded hover:border-brand-green border border-transparent flex gap-3 items-center">
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

        {step === 'category-selection' && (
            <div className="text-center max-w-4xl w-full animate-fade-in">
                <h3 className="text-2xl font-bold mb-4 text-brand-green">AI Creative Suite</h3>
                <p className="text-gray-400 mb-12">{t.subtitle}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <button onClick={() => { setCategory('graphics'); setStep('type-selection'); }} className="group bg-[#0A0A0A] border border-gray-800 hover:border-brand-green hover:shadow-[0_0_20px_rgba(123,193,67,0.1)] rounded-2xl p-10 transition-all duration-300">
                        <div className="bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-green group-hover:text-black transition-colors text-gray-400">
                            <Icons.Image />
                        </div>
                        <h3 className="text-3xl font-bold mb-3 text-white">{t.cat_graphics}</h3>
                        <p className="text-gray-500 text-sm">Logos, Identity, Social Media, Brochures</p>
                    </button>
                    <button onClick={() => { setCategory('web'); setDesignType('web'); setStep('input-form'); }} className="group bg-[#0A0A0A] border border-gray-800 hover:border-brand-green hover:shadow-[0_0_20px_rgba(123,193,67,0.1)] rounded-2xl p-10 transition-all duration-300">
                         <div className="bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-green group-hover:text-black transition-colors text-gray-400">
                            <Icons.Monitor />
                        </div>
                        <h3 className="text-3xl font-bold mb-3 text-white">{t.cat_web}</h3>
                        <p className="text-gray-500 text-sm">Full Website Template Kits</p>
                    </button>
                </div>
            </div>
        )}

        {step === 'type-selection' && (
            <div className="text-center w-full max-w-4xl animate-fade-in">
                 <button onClick={() => setStep('category-selection')} className="mb-8 text-gray-500 hover:text-white flex items-center gap-2 mx-auto transition-colors"><Icons.Back /> {t.back_to_menu}</button>
                 <h2 className="text-3xl font-bold mb-12">{category === 'graphics' ? 'Graphic Design' : 'Website Design'}</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { id: 'logo', label: t.type_logo, icon: '🎨' },
                        { id: 'identity', label: t.type_identity, icon: '🆔' },
                        { id: 'social', label: t.type_social, icon: '📱' },
                        { id: 'brochure', label: t.type_brochure, icon: '📄' },
                    ].map(type => (
                        <button key={type.id} onClick={() => { setDesignType(type.id as DesignType); setStep('input-form'); }} className="bg-[#0A0A0A] border border-gray-800 p-8 rounded-2xl hover:bg-gray-900 hover:border-brand-green transition-all duration-300 group">
                            <div className="text-4xl mb-6 grayscale group-hover:grayscale-0 transition-all">{type.icon}</div>
                            <div className="font-bold text-lg">{type.label}</div>
                            <div className="text-xs text-gray-600 mt-2">Create New</div>
                        </button>
                    ))}
                 </div>
            </div>
        )}

        {step === 'input-form' && (
            <div className="w-full max-w-2xl animate-fade-in">
                <button onClick={() => setStep(category === 'web' ? 'category-selection' : 'type-selection')} className="mb-4 text-gray-500 hover:text-white flex items-center gap-2"><Icons.Back /> {t.back_to_menu}</button>
                <div className="bg-[#0A0A0A] border border-gray-800 p-8 rounded-2xl space-y-8 shadow-2xl">
                    
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold mb-1 text-white">{designType === 'logo' ? 'Design Logo' : designType === 'social' ? 'Social Media' : designType === 'brochure' ? 'Brochure/Catalog' : 'Website Design'}</h2>
                        <p className="text-sm text-gray-400">Describe Business</p>
                    </div>

                    {/* Style Selection Cards - SVG Based */}
                    <div>
                        <label className="block text-brand-green text-sm font-bold mb-3">Choose a Style</label>
                        <div className="grid grid-cols-4 gap-4">
                            {DEFAULT_STYLES.map(style => (
                                <button 
                                    key={style.id}
                                    onClick={() => setBusinessData(p => ({...p, visualStyle: style.id}))}
                                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border transition-all duration-300 ${businessData.visualStyle === style.id ? 'bg-brand-green text-black border-brand-green shadow-[0_0_15px_rgba(123,193,67,0.4)]' : 'bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}
                                >
                                    <div className="mb-2"><style.Icon /></div>
                                    <span className="text-[10px] font-bold text-center leading-tight">{style.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conditional Upload for specific types */}
                    {(designType === 'logo' || designType === 'social' || designType === 'brochure' || designType === 'web') && (
                         <div className="border border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-brand-green cursor-pointer bg-gray-900/30 transition-colors group" onClick={() => document.getElementById('main-upload')?.click()}>
                            <div className="flex justify-center"><Icons.Upload /></div>
                            <p className="text-gray-400 text-sm group-hover:text-white transition-colors">{t.upload_label}</p>
                            <input id="main-upload" type="file" className="hidden" onChange={(e) => {
                                if(e.target.files?.[0]) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => setLogoBase64(ev.target?.result as string);
                                    reader.readAsDataURL(e.target.files[0]);
                                }
                            }}/>
                         </div>
                    )}

                    {/* Common Inputs */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">{t.input_name}</label>
                        <input type="text" value={businessData.name} onChange={e => setBusinessData(p => ({...p, name: e.target.value}))} className="w-full bg-black border border-gray-700 rounded-lg p-3 focus:border-brand-green outline-none text-white font-bold transition-colors" placeholder="Green Build" />
                    </div>

                    {/* Type Specific Inputs */}
                    
                    {/* LOGO Specifics */}
                    {designType === 'logo' && (
                        <div>
                             <label className="block text-brand-green text-sm font-bold mb-3">{t.input_logo_style}</label>
                             <div className="flex gap-4">
                                 <button onClick={() => setBusinessData(p => ({...p, logoStyle: '3d'}))} className={`flex-1 py-3 rounded-lg font-bold border transition-all ${businessData.logoStyle === '3d' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.style_3d}</button>
                                 <button onClick={() => setBusinessData(p => ({...p, logoStyle: 'flat'}))} className={`flex-1 py-3 rounded-lg font-bold border transition-all ${businessData.logoStyle === 'flat' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.style_flat}</button>
                             </div>
                        </div>
                    )}

                    {/* SOCIAL Specifics */}
                    {designType === 'social' && (
                         <div>
                            <label className="block text-brand-green text-sm font-bold mb-3">{t.input_social_platform}</label>
                            <div className="space-y-2">
                                {['instagram', 'facebook', 'linkedin'].map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => setBusinessData(prev => ({...prev, socialPlatform: p as any}))}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${businessData.socialPlatform === p ? 'bg-brand-green text-black border-brand-green font-bold' : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600'}`}
                                    >
                                        {p === 'instagram' ? t.platform_instagram : p === 'facebook' ? t.platform_facebook : t.platform_linkedin}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* BROCHURE Specifics */}
                    {designType === 'brochure' && (
                        <div className="space-y-4 border-t border-gray-800 pt-4">
                            <h3 className="text-brand-green font-bold text-sm">{t.input_brochure_settings}</h3>
                            
                            <div>
                                <label className="text-xs text-gray-400 mb-2 block">{t.input_size}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setBusinessData(p => ({...p, brochureSize: 'a4'}))} className={`p-2 text-xs rounded border transition-all ${businessData.brochureSize === 'a4' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.size_a4}</button>
                                    <button onClick={() => setBusinessData(p => ({...p, brochureSize: 'a5'}))} className={`p-2 text-xs rounded border transition-all ${businessData.brochureSize === 'a5' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.size_a5}</button>
                                    <button onClick={() => setBusinessData(p => ({...p, brochureSize: 'square'}))} className={`p-2 text-xs rounded border transition-all ${businessData.brochureSize === 'square' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.size_square}</button>
                                    <button onClick={() => setBusinessData(p => ({...p, brochureSize: 'folded'}))} className={`p-2 text-xs rounded border transition-all ${businessData.brochureSize === 'folded' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.size_folded}</button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-2 block">{t.input_orientation}</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setBusinessData(p => ({...p, brochureOrientation: 'portrait'}))} className={`flex-1 p-2 text-xs rounded border transition-all ${businessData.brochureOrientation === 'portrait' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.orientation_portrait}</button>
                                    <button onClick={() => setBusinessData(p => ({...p, brochureOrientation: 'landscape'}))} className={`flex-1 p-2 text-xs rounded border transition-all ${businessData.brochureOrientation === 'landscape' ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}>{t.orientation_landscape}</button>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs text-gray-400">{t.input_page_count}</label>
                                    <span className="text-xs font-bold text-white">{businessData.brochurePageCount}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="4" 
                                    max="12" 
                                    step="4" 
                                    value={businessData.brochurePageCount} 
                                    onChange={(e) => setBusinessData(p => ({...p, brochurePageCount: parseInt(e.target.value)}))}
                                    className="w-full accent-brand-green h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* WEB Specifics */}
                    {designType === 'web' && (
                        <div className="space-y-4">
                             <label className="block text-brand-green text-sm font-bold mb-2">{t.input_pages}</label>
                             <div className="grid grid-cols-3 gap-2">
                                 {['Home', 'About Us', 'Services', 'Contact', 'Portfolio', 'Blog'].map(page => (
                                     <button 
                                        key={page}
                                        onClick={() => {
                                            const current = businessData.selectedPages || [];
                                            const updated = current.includes(page) ? current.filter(p => p !== page) : [...current, page];
                                            setBusinessData(p => ({...p, selectedPages: updated}));
                                        }}
                                        className={`p-2 text-xs rounded border transition-all ${businessData.selectedPages?.includes(page) ? 'bg-brand-green text-black border-brand-green' : 'bg-gray-900 text-gray-400 border-gray-800'}`}
                                     >
                                         {page}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">{t.input_description}</label>
                        <textarea value={businessData.description} onChange={e => setBusinessData(p => ({...p, description: e.target.value}))} className="w-full bg-black border border-gray-700 rounded-lg p-3 h-24 focus:border-brand-green outline-none text-white resize-none transition-colors" placeholder={t.placeholder_description} />
                    </div>

                    <button onClick={() => { if(!businessData.name) return alert("Name required"); setShowContactModal(true); }} className="w-full bg-brand-green hover:bg-white text-black font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(123,193,67,0.3)] hover:shadow-[0_0_30px_rgba(123,193,67,0.6)]">
                        {t.generate_btn}
                    </button>
                </div>
            </div>
        )}

        {step === 'generating' && (
            <div className="text-center animate-fade-in flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-24 h-24 border-4 border-gray-800 border-t-brand-green rounded-full animate-spin mb-8"></div>
                <h2 className="text-3xl font-bold mb-4 text-white">{t.generating}</h2>
                <p className="text-brand-green animate-pulse text-lg">{loadingStatus}</p>
            </div>
        )}

        {step === 'result' && generatedResult && (
            <div className="w-full max-w-6xl animate-fade-in flex flex-col md:flex-row gap-8">
                <div className="flex-1 bg-[#0A0A0A] border border-gray-800 rounded-2xl p-8 flex items-center justify-center min-h-[500px] shadow-2xl relative overflow-hidden group">
                     {/* Background Grid Pattern */}
                     <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>
                    <img src={generatedResult.imageUrl} className="max-w-full max-h-[80vh] shadow-2xl rounded relative z-10 transition-transform duration-500 group-hover:scale-[1.02]" alt="Generated Design" />
                </div>
                <div className="w-full md:w-80 space-y-4">
                     <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-xl shadow-lg">
                        <h3 className="font-bold mb-6 text-brand-green text-lg border-b border-gray-800 pb-2">Actions</h3>
                        <button onClick={() => {
                            const link = document.createElement('a');
                            link.href = generatedResult.imageUrl;
                            link.download = `${generatedResult.data.name}.svg`;
                            link.click();
                        }} className="w-full bg-white text-black font-bold py-3 rounded-lg mb-3 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                            <span>⬇️</span> {t.download_btn}
                        </button>
                        <button onClick={() => setStep('category-selection')} className="w-full border border-gray-700 text-gray-400 py-3 rounded-lg hover:text-white hover:border-gray-500 transition-colors">Create New</button>
                     </div>
                     <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-xl shadow-lg">
                        <h3 className="font-bold mb-2 text-white">Details</h3>
                        <p className="text-xs text-gray-500">Project: <span className="text-gray-300">{generatedResult.data.name}</span></p>
                        <p className="text-xs text-gray-500">Style: <span className="text-gray-300 capitalize">{generatedResult.data.visualStyle}</span></p>
                        <p className="text-xs text-gray-500">Date: <span className="text-gray-300">{new Date().toLocaleDateString()}</span></p>
                     </div>
                </div>
            </div>
        )}

        {showContactModal && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
                    <h2 className="text-2xl font-bold mb-2 text-white">{t.contact_modal_title}</h2>
                    <p className="text-gray-400 mb-6">{t.contact_modal_subtitle}</p>
                    <div className="space-y-4">
                        <div>
                             <input value={contactDetails.name} onChange={e=>setContactDetails({...contactDetails, name: e.target.value})} placeholder={t.contact_name} className={`w-full bg-black border ${validationErrors.name ? 'border-red-500' : 'border-gray-700'} rounded-lg p-3 text-white focus:border-brand-green outline-none`} />
                             {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                        </div>
                        <div>
                            <input value={contactDetails.company} onChange={e=>setContactDetails({...contactDetails, company: e.target.value})} placeholder={t.contact_company} className={`w-full bg-black border ${validationErrors.company ? 'border-red-500' : 'border-gray-700'} rounded-lg p-3 text-white focus:border-brand-green outline-none`} />
                             {validationErrors.company && <p className="text-red-500 text-xs mt-1">{validationErrors.company}</p>}
                        </div>
                        <div>
                            <input value={contactDetails.email} onChange={e=>setContactDetails({...contactDetails, email: e.target.value})} placeholder={t.contact_email} className={`w-full bg-black border ${validationErrors.email ? 'border-red-500' : 'border-gray-700'} rounded-lg p-3 text-white focus:border-brand-green outline-none`} />
                             {validationErrors.email && <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>}
                        </div>
                        <div>
                            <input value={contactDetails.phone} onChange={e=>setContactDetails({...contactDetails, phone: e.target.value})} placeholder={t.contact_phone} className={`w-full bg-black border ${validationErrors.phone ? 'border-red-500' : 'border-gray-700'} rounded-lg p-3 text-white focus:border-brand-green outline-none`} />
                             {validationErrors.phone && <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>}
                        </div>
                        <button onClick={handleContactSubmit} className="w-full bg-brand-green text-black font-bold py-3 rounded-lg hover:bg-white transition-colors mt-2">{t.contact_submit}</button>
                        <button onClick={() => setShowContactModal(false)} className="w-full text-gray-500 mt-2 hover:text-white text-sm">Cancel</button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;