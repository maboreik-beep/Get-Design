
import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { 
  DesignType, 
  BusinessData, 
  GeneratedResult, 
  ContactDetails, 
  Language,
  VisualStyle,
  InputMode, // New InputMode type
  GeneratedResultStatus, // New
} from './types';
import { TRANSLATIONS, WEBSITE_PAGES, SUPPORT_NUMBER, GENERIC_WEB_DRAFT_SVG_DATA_URL } from './constants'; // Import GENERIC_WEB_DRAFT_SVG_DATA_URL
import { generateDesign, fetchDesignStatus } from './services/geminiService'; // Fix: Now correctly importing named export
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
  const [step, setStep] = useState<'category-selection' | 'type-selection' | 'input-form' | 'generating' | 'result'>('category-selection');
  const [category, setCategory] = useState<'graphics' | 'web' | null>(null);
  const [designType, setDesignType] = useState<DesignType>('logo');
  
  // Loading Status
  const [loadingStatus, setLoadingStatus] = useState("");

  // Input Mode
  const [inputMode, setInputMode] = useState<InputMode>('form'); // New state for input method

  // Data
  const [businessData, setBusinessData] = useState<BusinessData>({
    name: '',
    industry: '',
    description: '',
    selectedPages: [],
    brochureOrientation: 'portrait',
    brochurePageCount: 4,
    brochureSize: 'a4',
    logoStyle: '3d', // Default
    socialPlatform: 'instagram', // Default
    customColorPalette: '', // Default to empty, AI will infer or use this
    visualStyle: 'minimalist', // Default
    postContent: '' // Default
  });

  // Uploads
  const [logoBase64, setLogoBase64] = useState<string | null>(null); // For branding (manual form)
  const [brochureBase64, setBrochureBase64] = useState<string[] | null>(null); // For content (manual form) - Now array
  const [zipFile, setZipFile] = useState<File | null>(null); // New state for zip upload

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

  // Polling ref for web draft updates
  const draftPollingIntervalRef = useRef<number | null>(null);


  // --- Effects ---
  useEffect(() => {
    // Load history and contact details
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

    // Detect Admin Route
    if (window.location.pathname === '/admin') {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    // Handle hash routing for deep linking to generated designs
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#result-')) {
        const designId = hash.substring('#result-'.length);
        const foundDesign = history.find(d => d.id === designId);
        if (foundDesign) {
          loadFromHistory(foundDesign);
        } else {
          // If not in local history, we might need to fetch it (e.g., if shared link)
          // For now, if not in history, just go to category selection
          setStep('category-selection'); 
          setCategory(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Also check on initial load
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [history]); // Re-run if history changes to ensure deep links work with new items

  // Effect for polling web drafts to update `My Creations` and current `generatedResult`
  useEffect(() => {
    if (draftPollingIntervalRef.current) {
      clearInterval(draftPollingIntervalRef.current);
    }

    const webPendingDrafts = history.filter(item => 
      item.type === 'web' && 
      (item.status === 'initial_draft_placeholder' || item.status === 'ai_draft_generated')
    );

    if (webPendingDrafts.length > 0) {
      draftPollingIntervalRef.current = setInterval(async () => {
        for (const draft of webPendingDrafts) {
          if (draft.designTaskId && (draft.status === 'initial_draft_placeholder' || draft.status === 'ai_draft_generated')) {
            try {
              const { imageUrl, status } = await fetchDesignStatus(draft.id as unknown as number); // designId is actually GeneratedDesigns ID
              if (status !== draft.status || imageUrl !== draft.imageUrl) {
                setHistory(prevHistory => prevHistory.map(item => 
                  item.id === draft.id ? { ...item, imageUrl, status } : item
                ));
                // If the current result is this draft, update it too
                if (generatedResult?.id === draft.id) {
                  setGeneratedResult(prev => prev ? { ...prev, imageUrl, status } : null);
                }
              }
            } catch (err) {
              console.error(`Failed to poll status for design ${draft.id}:`, err);
            }
          }
        }
      }, 15000) as unknown as number; // Poll every 15 seconds
    }

    return () => {
      if (draftPollingIntervalRef.current !== null) {
        clearInterval(draftPollingIntervalRef.current);
      }
    };
  }, [history, generatedResult]); // Re-run effect if history or current result changes


  // Determine if form fields (for manual input) should be disabled
  // This avoids TypeScript's type narrowing within conditional JSX and the "unintentional comparison" error
  const isDisabledForFormFields = inputMode === 'zip';

  // --- Handlers ---

  const handleCategorySelect = (cat: 'graphics' | 'web') => {
    setCategory(cat);
    if (cat === 'web') {
      setDesignType('web');
      setStep('input-form');
      // Default pages for web
      setBusinessData(prev => ({ ...prev, selectedPages: ["Home", "About Us", "Services", "Contact"] }));
    } else {
      setStep('type-selection');
    }
  };

  const handleTypeSelect = (type: DesignType) => {
    setDesignType(type);
    setStep('input-form');
    // Default brochure settings
    if (type === 'brochure') {
      setBusinessData(prev => ({...prev, brochureOrientation: 'portrait', brochurePageCount: 4, brochureSize: 'a4'}));
    }
    // Default Social settings
    if (type === 'social') {
      setBusinessData(prev => ({...prev, socialPlatform: 'instagram'}));
    }
    // Default Logo settings
    if (type === 'logo') {
      setBusinessData(prev => ({...prev, logoStyle: '3d'}));
    }
  };

  const handlePageToggle = (page: string) => {
    setBusinessData(prev => {
      const current = prev.selectedPages || [];
      if (current.includes(page)) {
        return { ...prev, selectedPages: current.filter(p => p !== page) };
      } else {
        if (current.length >= 5) return prev; // Max 5
        return { ...prev, selectedPages: [...current, page] };
      }
    });
  };

  const handleGenerateClick = () => {
    // Validation
    if (inputMode === 'form') {
      if (!businessData.name) {
        setError(lang === 'en' ? "Please fill in Business Name." : "يرجى إدخال اسم النشاط.");
        return;
      }
      if (designType === 'web' && (!businessData.selectedPages || businessData.selectedPages.length === 0)) {
        setError(lang === 'en' ? "Please select at least one page." : "يرجى اختيار صفحة واحدة على الأقل.");
        return;
      }
    } else if (inputMode === 'zip') {
      if (!zipFile) {
        setError(t.validation_zip_req);
        return;
      }
    }
    
    setError(null);

    // If contact details are available, proceed to generation, otherwise show modal
    if (contactDetails.name && contactDetails.email && contactDetails.company && contactDetails.phone) {
      processGeneration();
    } else {
      setShowContactModal(true);
    }
  };

  const validateContactForm = (): boolean => {
    const errors: Partial<Record<keyof ContactDetails, string>> = {};
    let isValid = true;

    if (!contactDetails.name.trim()) {
      errors.name = t.validation_name_req;
      isValid = false;
    }
    
    if (!contactDetails.company.trim()) {
      errors.company = t.validation_company_req;
      isValid = false;
    }

    if (!contactDetails.email.trim()) {
      errors.email = t.validation_email_req;
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactDetails.email)) {
      errors.email = t.validation_email;
      isValid = false;
    }

    if (!contactDetails.phone.trim()) {
      errors.phone = t.validation_phone_req;
      isValid = false;
    } else if (!/^\+?[\d\s-]{8,}$/.test(contactDetails.phone)) { // Basic phone validation
      errors.phone = t.validation_phone;
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateContactForm()) {
      return;
    }

    try {
      // Send contact details to the backend to save lead and get contactId
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactDetails.name,
          company: contactDetails.company,
          email: contactDetails.email,
          phone: contactDetails.phone,
          design_interest: designType, // Pass the current designType as interest
        })
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || t.error_generic);
      }
      
      const { id: contactId } = responseData; // Get contactId from backend

      // Update contact details with ID and save locally
      const updatedContactDetails = { ...contactDetails, id: contactId };
      setContactDetails(updatedContactDetails);
      localStorage.setItem('contact_details', JSON.stringify(updatedContactDetails));

      // Set contactId in businessData for the generation request
      setBusinessData(prev => ({ ...prev, contactId: contactId }));
      
      setShowContactModal(false);
      processGeneration();

    } catch (err: any) {
      console.error("Contact submission failed:", err);
      setError(err.message || t.error_generic);
    }
  };

  const processGeneration = async () => {
    setStep('generating');
    setLoadingStatus(t.generating); // Default msg
    setError(null);
    setCurrentImageIndex(0);

    try {
      const dataForBackend: BusinessData = {
        ...businessData,
        contactId: contactDetails.id, // Ensure contactId is passed
        brochureBase64: brochureBase64, // Pass brochureBase64 here
      };

      const result = await generateDesign(
        designType,
        inputMode === 'form' ? 'form' : 'zip', // Corrected inputMode for API
        dataForBackend,
        inputMode === 'form' ? (logoBase64 || null) : null, // Only send if form mode
        (status) => setLoadingStatus(status), // Update Status Callback
        inputMode === 'zip' ? zipFile : null // Pass zipFile if in zip mode
      );

      setGeneratedResult(result);
      
      const MAX_HISTORY_ITEMS = 3; 
      let newHistory = [result, ...history];
      
      if (newHistory.length > MAX_HISTORY_ITEMS) {
        newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
      }
      
      setHistory(newHistory);
      
      try {
        localStorage.setItem('design_history', JSON.stringify(newHistory));
      } catch (e) {
        console.warn("Storage Quota Exceeded. Oldest items not saved.");
      }

      setStep('result');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || '';
      
      // Error handling is now generic, as specific API key errors are handled by the backend.
      setError(errMsg || t.error_generic);
      setStep('input-form');
    }
  };

  // --- Branding & Image Utilities ---
  const createBrandedImageBlob = async (imageUrl: string): Promise<Blob | null> => {
    // For pending web designs, don't try to create a branded image from a placeholder
    if (imageUrl === GENERIC_WEB_DRAFT_SVG_DATA_URL || imageUrl === '') { // Use the constant
      return null;
    }

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      await new Promise(r => img.onload = r);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if(!ctx) return null;

      const HEADER_HEIGHT = 100;
      canvas.width = img.width;
      canvas.height = img.height + HEADER_HEIGHT;

      // Draw Header Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);

      // Draw "Get Design" Logo in Header
      ctx.textAlign = 'center';
      const centerX = canvas.width / 2;

      // "NOW"
      ctx.font = '300 12px Inter, sans-serif';
      ctx.fillStyle = '#9ca3af'; // gray-400
      ctx.fillText('NOW', centerX, 30);

      // "Get Design"
      const textY = 60;
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      
      ctx.fillText('Get', centerX - 40, textY);
      
      ctx.font = '300 28px Inter, sans-serif';
      ctx.fillText('Design', centerX + 30, textY);

      // Green Icon (Triangle) to the right of text
      const iconX = centerX + 100;
      const iconY = 40;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY);
      ctx.lineTo(iconX + 20, iconY + 12);
      ctx.lineTo(iconX, iconY + 24);
      ctx.closePath();
      ctx.fillStyle = '#7bc143';
      ctx.fill();

      // Draw Content Image
      ctx.drawImage(img, 0, HEADER_HEIGHT);

      return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png');
      });
    } catch (e) {
      console.error("Failed to create branded image", e);
      return null;
    }
  };

  const handleWhatsAppRequest = async (result: GeneratedResult) => {
    const contact = contactDetails;
    let message = "";

    if (!result.imageUrl || result.status !== 'ready') { // Only allow if status is 'ready'
      alert(lang === 'en' 
        ? "This design is not yet ready. Please wait for the final generation."
        : "هذا التصميم ليس جاهزًا بعد. يرجى الانتظار حتى يكتمل التوليد النهائي.");
      return;
    }

    // 1. Prepare Message
    let templateRef = result.templateId ? ` (Template ID: ${result.templateId})` : '';

    if (result.type === 'web') {
      message = `Hi, I am ${contact.name || "User"} from ${contact.company || "Company"}. I am interested to publish this website design concept${templateRef} (see attached image). Please let me know the time and cost.`;
    } else {
      message = `Hi, I am ${contact.name || "User"} from ${contact.company || "Company"}. I am interested to get the ready to use and open-source files for this design concept${templateRef} (see attached image). Please let me know the time and cost.`;
    }
    
    // 2. Identify image to attach
    const imageToShareUrl = ((result.type === 'web' || result.type === 'brochure') && result.images && result.images.length > 0) 
        ? result.images[currentImageIndex] 
        : result.imageUrl;

    // 3. Download image first so user can attach it
    try {
        const blob = await createBrandedImageBlob(imageToShareUrl);
        if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `GetDesign_Request_${result.id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Inform user
            alert(lang === 'en' 
                ? "The design image has been downloaded. Please attach it to the WhatsApp chat that will open now." 
                : "تم تحميل صورة التصميم. يرجى إرفاقها في محادثة الواتساب التي ستفتح الآن.");
        }
    } catch (e) {
        console.error("Auto-download for WhatsApp failed", e);
    }

    // 4. Open WhatsApp
    const url = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleShare = async (result: GeneratedResult) => {
    if (!result.imageUrl || result.status !== 'ready') { // Only allow if status is 'ready'
      alert(lang === 'en' 
        ? "This design is not yet ready. Please wait for the final generation before sharing."
        : "هذا التصميم ليس جاهزًا بعد. يرجى الانتظار حتى يكتمل التوليد النهائي قبل المشاركة.");
      return;
    }

    // Use the specific enthusiastic text from constants
    const shareText = t.share_text_template; 
    const url = 'https://getdesign.cloud';
    
    const imageToShareUrl = ((result.type === 'web' || result.type === 'brochure') && result.images && result.images.length > 0) 
        ? result.images[currentImageIndex] 
        : result.imageUrl;

    const blob = await createBrandedImageBlob(imageToShareUrl);
    
    let filesArray: File[] = [];

    if (blob) {
      const file = new File([blob], `getdesign_${result.id}.png`, { type: blob.type });
      filesArray = [file];
    }

    const shareData: ShareData = {
      title: 'Get Design AI',
      text: `${shareText}\n${url}`,
      url: url,
    };

    if (navigator.share) {
      try {
        if (filesArray.length > 0 && navigator.canShare && navigator.canShare({ files: filesArray })) {
           await navigator.share({ ...shareData, files: filesArray });
        } else {
           await navigator.share(shareData);
        }
      } catch (err) {
        console.warn('Share failed or canceled', err);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${url}`);
      alert(t.share_copied);
    }
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    if (imageUrl === GENERIC_WEB_DRAFT_SVG_DATA_URL || imageUrl === '' || generatedResult?.status !== 'ready') { // Use constant and check status
      alert(lang === 'en' 
        ? "This design is not yet ready for download. Please wait for the final generation."
        : "هذا التصميم ليس جاهزًا للتحميل بعد. يرجى الانتظار حتى يكتمل التوليد النهائي.");
      return;
    }

    const blob = await createBrandedImageBlob(imageUrl);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click(); // Programmatically click the link to trigger download
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Fallback for non-branded download if blob creation fails
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      link.click();
    }
  };

  const loadFromHistory = (item: GeneratedResult) => {
    setGeneratedResult(item);
    setBusinessData(item.data);
    setDesignType(item.type);
    setCategory(item.type === 'web' ? 'web' : 'graphics');
    setStep('result');
    setShowHistory(false);
    setCurrentImageIndex(0);
  };

  // --- Render ---

  if (isAdmin) {
    return <AdminDashboard PUBLIC_APP_URL={process.env.PUBLIC_APP_URL || 'https://www.getdesign.cloud'} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans text-white ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Navbar */}
      <header className="border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div onClick={() => { setStep('category-selection'); setCategory(null); }} className="cursor-pointer">
             <Logo />
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="text-gray-400 hover:text-white transition-colors text-sm font-semibold uppercase">
               {lang === 'en' ? 'العربية' : 'English'}
             </button>
             <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg hover:border-brand-green hover:text-brand-green transition-all">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <span className="hidden sm:inline font-medium text-sm">{t.my_creations}</span>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8 relative z-10">
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-100 rounded-lg animate-fade-in flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-white">&times;</button>
          </div>
        )}

        {/* STEP 1: CATEGORY SELECTION */}
        {step === 'category-selection' && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-4xl font-bold text-center mb-4"><span className="text-brand-green">AI</span> Creative Suite</h1>
            <p className="text-gray-400 text-center mb-12 text-lg">{t.subtitle}</p>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Graphic Design Card */}
              <div 
                onClick={() => handleCategorySelect('graphics')}
                className="group relative h-80 bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800 hover:border-brand-green overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-green/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
                   <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-brand-green group-hover:text-black transition-colors">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   </div>
                   <h2 className="text-3xl font-bold mb-2">{t.cat_graphics}</h2>
                   <p className="text-gray-400 group-hover:text-gray-200">Logos, Identity, Social Media, Brochures</p>
                </div>
              </div>

              {/* Web Design Card */}
              <div 
                onClick={() => handleCategorySelect('web')}
                className="group relative h-80 bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-800 hover:border-blue-500 overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
                   <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-black transition-colors">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                   </div>
                   <h2 className="text-3xl font-bold mb-2">{t.cat_web}</h2>
                   <p className="text-gray-400 group-hover:text-gray-200">Full Website Template Kits</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TYPE SELECTION (Graphics Only) */}
        {step === 'type-selection' && category === 'graphics' && (
          <div className="max-w-6xl mx-auto animate-fade-in">
             <button onClick={() => setStep('category-selection')} className="mb-8 text-gray-400 hover:text-white flex items-center gap-2">
              <span>←</span> {t.back_to_menu}
            </button>
            <h2 className="text-3xl font-bold text-center mb-10">{t.select_type}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { id: 'logo', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', label: t.type_logo },
                { id: 'identity', icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .884.386 1.673 1 2.223', label: t.type_identity },
                { id: 'social', icon: 'M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11', label: t.type_social },
                { id: 'brochure', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: t.type_brochure },
              ].map((item) => (
                <div 
                  key={item.id}
                  onClick={() => handleTypeSelect(item.id as DesignType)}
                  className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 hover:border-brand-green rounded-xl p-6 cursor-pointer transition-all hover:-translate-y-1 flex flex-col items-center text-center group"
                >
                  <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mb-4 text-brand-green group-hover:scale-110 transition-transform">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                  </div>
                  <h3 className="font-semibold text-lg">{item.label}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: INPUT FORM */}
        {step === 'input-form' && (
          <div className="max-w-3xl mx-auto animate-fade-in pb-20">
            <button onClick={() => category === 'web' ? setStep('category-selection') : setStep('type-selection')} className="mb-6 text-gray-400 hover:text-white flex items-center gap-2">
              <span>←</span> {t.back_to_menu}
            </button>
            
            <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-2xl p-8 shadow-2xl">
              <div className="mb-8 text-center">
                 <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2 text-white">
                   {designType === 'web' ? t.type_web : 
                    designType === 'logo' ? t.type_logo :
                    designType === 'identity' ? t.type_identity :
                    designType === 'social' ? t.type_social :
                    t.type_brochure}
                 </h2>
                 <p className="text-gray-400">{t.tab_describe}</p>
              </div>

              {/* Input Mode Toggle */}
              <div className="mb-8 bg-black/30 p-2 rounded-xl flex border border-gray-800">
                <button
                  onClick={() => setInputMode('form')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    inputMode === 'form'
                      ? 'bg-brand-green text-black shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t.mode_form_input}
                </button>
                <button
                  onClick={() => setInputMode('zip')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    inputMode === 'zip'
                      ? 'bg-brand-green text-black shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t.mode_zip_upload}
                </button>
              </div>

              <div className="space-y-8">
                {/* Zip Upload Section (Conditional) */}
                {inputMode === 'zip' && (
                  <div className="bg-black/30 p-6 rounded-2xl border border-gray-800">
                    <label className="block text-sm font-medium text-gray-400 mb-2">{t.upload_zip_label}</label>
                    {/* Use File type for zip upload */}
                    <FileUpload<File> 
                      label={zipFile ? t.zip_uploaded_msg : t.upload_zip_label}
                      onFileSelect={setZipFile} // setZipFile expects File
                      accept=".zip"
                      returnFileObject={true}
                      // No disabled prop needed here, this is the active input mode
                    />
                    {zipFile && <p className="text-xs text-brand-green mt-2 text-center">{t.zip_uploaded_msg}</p>}
                    <p className="text-xs text-gray-500 mt-2 text-center">{t.zip_upload_hint}</p>
                  </div>
                )}

                {/* Manual Input Section (Conditional) */}
                {inputMode === 'form' && (
                  <>
                    {/* Upload Logo Section */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          {/* Use string type for image uploads (base64) */}
                          <FileUpload<string> 
                              label={t.upload_label}
                              onFileSelect={setLogoBase64}
                              disabled={isDisabledForFormFields} // Use the helper variable
                            />
                            {logoBase64 && <p className="text-xs text-brand-green mt-2 text-center">Logo Loaded</p>}
                        </div>
                    </div>

                    {/* Core Info */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">{t.input_name}</label>
                          <input 
                            type="text" 
                            value={businessData.name}
                            onChange={(e) => setBusinessData({...businessData, name: e.target.value})}
                            placeholder={t.placeholder_name}
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                            disabled={isDisabledForFormFields} // Use the helper variable
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">{t.input_industry}</label>
                          <input 
                            type="text" 
                            value={businessData.industry}
                            onChange={(e) => setBusinessData({...businessData, industry: e.target.value})}
                            placeholder={t.placeholder_industry}
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                            disabled={isDisabledForFormFields} // Use the helper variable
                          />
                        </div>
                    </div>

                    {/* VISUAL STYLE & COLOR (New Section) */}
                    <div className="bg-black/30 p-6 rounded-2xl border border-gray-800">
                      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                      Visual Direction
                      </h3>
                      
                      {/* Custom Color Input */}
                      <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-400 mb-3">{t.input_custom_colors}</label>
                          <textarea
                            value={businessData.customColorPalette || ''}
                            onChange={(e) => setBusinessData({...businessData, customColorPalette: e.target.value})}
                            placeholder={t.placeholder_custom_colors}
                            rows={3}
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                            disabled={isDisabledForFormFields} // Use the helper variable
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            {logoBase64 ? "Note: If a logo is uploaded, colors will be primarily derived from it, with your input used for refinement or accents." : ""}
                            {(designType === 'brochure' || designType === 'web') && brochureBase64 ? "Note: If content is uploaded, colors will be primarily derived from it, with your input used for refinement or accents." : ""}
                            {isDisabledForFormFields ? "Note: If a zip is uploaded, colors will be primarily derived from assets within, with your input used for refinement or accents." : ""}
                          </p>
                      </div>

                      {/* Design Style */}
                      <div>
                          <label className="block text-sm font-medium text-gray-400 mb-3">{t.input_visual_style}</label>
                          <div className="flex flex-wrap gap-3">
                            {(['minimalist', 'bold', 'elegant', 'futuristic'] as VisualStyle[]).map(style => (
                                <button
                                  key={style}
                                  onClick={() => setBusinessData({...businessData, visualStyle: style})}
                                  className={`px-4 py-2 rounded-lg text-sm transition-all border ${
                                    businessData.visualStyle === style
                                    ? 'bg-white text-black border-white font-bold'
                                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                                  }`}
                                  disabled={isDisabledForFormFields} // Use the helper variable
                                >
                                  {t[`style_${style}` as keyof typeof t] as string}
                                </button>
                            ))}
                          </div>
                      </div>
                    </div>

                    {designType === 'logo' && (
                      <div className="bg-black/30 p-6 rounded-2xl border border-gray-800">
                        <label className="block text-sm font-medium text-brand-green mb-3">{t.input_logo_style}</label>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setBusinessData({...businessData, logoStyle: '3d'})}
                            className={`flex-1 py-3 rounded-xl border transition-all font-medium ${
                              businessData.logoStyle === '3d'
                                ? 'bg-brand-green text-black border-brand-green font-bold'
                                : 'bg-gray-800 text-gray-400 border-gray-700'
                            }`}
                            disabled={isDisabledForFormFields} // Use the helper variable
                          >
                            {t.style_3d}
                          </button>
                          <button 
                            onClick={() => setBusinessData({...businessData, logoStyle: 'flat'})}
                            className={`flex-1 py-3 rounded-xl border transition-all font-medium ${
                              businessData.logoStyle === 'flat'
                                ? 'bg-brand-green text-black border-brand-green font-bold'
                                : 'bg-gray-800 text-gray-400 border-gray-700'
                            }`}
                            disabled={isDisabledForFormFields} // Use the helper variable
                          >
                            {t.style_flat}
                          </button>
                        </div>
                      </div>
                    )}

                    {designType === 'social' && (
                      <div className="bg-black/30 p-6 rounded-2xl border border-gray-800">
                        <label className="block text-sm font-medium text-brand-green mb-3">{t.input_social_platform}</label>
                        <div className="grid gap-2 mb-4">
                          {['instagram', 'facebook', 'linkedin'].map(platform => (
                              <button 
                                key={platform}
                                onClick={() => setBusinessData({...businessData, socialPlatform: platform as any})}
                                className={`py-3 px-4 rounded-xl border text-left transition-all ${
                                  businessData.socialPlatform === platform
                                    ? 'bg-brand-green text-black border-brand-green font-bold'
                                    : 'bg-gray-800 text-gray-400 border-gray-700'
                                }`}
                                disabled={isDisabledForFormFields} // Use the helper variable
                              >
                                {t[`platform_${platform}` as keyof typeof t] as string}
                              </button>
                          ))}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">{t.input_post_content}</label>
                          <textarea 
                            value={businessData.postContent || ''}
                            onChange={(e) => setBusinessData({...businessData, postContent: e.target.value})}
                            placeholder={t.placeholder_post_content}
                            rows={3}
                            className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                            disabled={isDisabledForFormFields} // Use the helper variable
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">{t.input_description}</label>
                      <textarea 
                        value={businessData.description}
                        onChange={(e) => setBusinessData({...businessData, description: e.target.value})}
                        placeholder={t.placeholder_description}
                        rows={4}
                        className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                        disabled={isDisabledForFormFields} // Use the helper variable
                      />
                    </div>

                    {designType === 'brochure' && (
                      <div className="bg-black/30 p-6 rounded-2xl border border-gray-800 space-y-6">
                        <h3 className="text-brand-green font-medium mb-2 border-b border-gray-700 pb-2">{t.input_brochure_settings}</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">{t.input_size}</label>
                            <div className="grid grid-cols-2 gap-3">
                                {(['a4', 'a5', 'square', 'folded'] as const).map(size => (
                                    <button
                                      key={size}
                                      onClick={() => setBusinessData({...businessData, brochureSize: size})}
                                      className={`py-2 rounded-lg border transition-all text-sm ${
                                          businessData.brochureSize === size
                                          ? 'bg-brand-green text-black border-brand-green font-bold'
                                          : 'bg-gray-800 text-gray-400 border-gray-700'
                                      }`}
                                      disabled={isDisabledForFormFields} // Use the helper variable
                                    >
                                      {t[`size_${size}` as keyof typeof t] as string}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">{t.input_orientation}</label>
                          <div className="flex gap-4">
                            <button 
                              onClick={() => setBusinessData({...businessData, brochureOrientation: 'portrait'})}
                              className={`flex-1 py-2 rounded-lg border transition-all ${
                                businessData.brochureOrientation === 'portrait'
                                  ? 'bg-brand-green text-black border-brand-green font-bold'
                                  : 'bg-gray-800 text-gray-400 border-gray-700'
                              }`}
                              disabled={isDisabledForFormFields} // Use the helper variable
                            >
                              {t.orientation_portrait}
                            </button>
                            <button 
                                onClick={() => setBusinessData({...businessData, brochureOrientation: 'landscape'})}
                                className={`flex-1 py-2 rounded-lg border transition-all ${
                                  businessData.brochureOrientation === 'landscape'
                                    ? 'bg-brand-green text-black border-brand-green font-bold'
                                    : 'bg-gray-800 text-gray-400 border-gray-700'
                                }`}
                                disabled={isDisabledForFormFields} // Use the helper variable
                            >
                              {t.orientation_landscape}
                            </button>
                          </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              {t.input_page_count}: <span className="text-white font-bold">{businessData.brochurePageCount}</span>
                            </label>
                            <input 
                              type="range" 
                              min="1" 
                              max="12" 
                              value={businessData.brochurePageCount} 
                              onChange={(e) => setBusinessData({...businessData, brochurePageCount: parseInt(e.target.value)})}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-green"
                              disabled={isDisabledForFormFields} // Use the helper variable
                            />
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-400 mb-2">{t.upload_brochure_label}</label>
                          {/* Use string[] type for multiple brochure uploads (base64) */}
                          <FileUpload<string> 
                              label={brochureBase64 && brochureBase64.length > 0 ? `${brochureBase64.length} files loaded` : t.upload_brochure_label}
                              onFileSelect={setBrochureBase64} // setBrochureBase64 expects string[]
                              accept="image/png, image/jpeg, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              multiple={true}
                              disabled={isDisabledForFormFields} // Use the helper variable
                            />
                        </div>
                      </div>
                    )}

                    {designType === 'web' && (
                      <div className="bg-black/30 p-6 rounded-2xl border border-gray-800">
                        <label className="block text-sm font-medium text-brand-green mb-3">{t.input_pages}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                            {WEBSITE_PAGES.map(page => (
                              <div 
                                key={page}
                                onClick={() => !isDisabledForFormFields && handlePageToggle(page)} // Only allow toggle if not disabled
                                className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors border ${
                                  businessData.selectedPages?.includes(page) 
                                  ? 'bg-brand-green text-black border-brand-green font-semibold' 
                                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                                } ${isDisabledForFormFields ? 'opacity-50 cursor-not-allowed' : ''}`} // Use helper variable here too
                              >
                                {page}
                              </div>
                            ))}
                        </div>
                        
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-400 mb-2">{t.upload_brochure_label}</label>
                          {/* Use string[] type for multiple brochure uploads (base64) */}
                          <FileUpload<string> 
                              label={brochureBase64 && brochureBase64.length > 0 ? `${brochureBase64.length} files loaded` : t.upload_brochure_label}
                              onFileSelect={setBrochureBase64}
                              accept="image/png, image/jpeg, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              multiple={true}
                              disabled={isDisabledForFormFields} // Use the helper variable
                            />
                        </div>
                      </div>
                    )}
                  </>
                )} {/* End of Manual Input Section */}

                <button 
                  onClick={handleGenerateClick}
                  className="w-full bg-brand-green hover:bg-lime-500 text-black font-bold text-xl py-5 rounded-xl shadow-lg shadow-brand-green/20 transition-all hover:scale-[1.01] active:scale-[0.99] mt-6"
                >
                  {designType === 'web' ? t.contact_submit : t.generate_btn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: LOADING */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand-green rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <svg className="w-10 h-10 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
            </div>
            {/* Detailed Status Text */}
            <h2 className="text-2xl font-bold text-center animate-pulse mb-2">
              {generatedResult?.status === 'initial_draft_placeholder' ? t.design_status_initial_draft_placeholder : 
               generatedResult?.status === 'pending_designer_review' ? t.design_status_pending_review_mockup : 
               t.generating}
            </h2>
            <p className="text-brand-green text-sm font-medium tracking-wide uppercase animate-pulse-slow">{loadingStatus}</p>
          </div>
        )}

        {/* STEP 5: RESULT */}
        {step === 'result' && generatedResult && (
           <div className="max-w-5xl mx-auto animate-fade-in pb-20">
             <button onClick={() => setStep('input-form')} className="mb-6 text-gray-400 hover:text-white flex items-center gap-2">
                <span>←</span> {t.load_design}
             </button>

             <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                
                {(generatedResult.status === 'initial_draft_placeholder' || generatedResult.status === 'ai_draft_generated' || generatedResult.status === 'pending_designer_review' || generatedResult.status === 'generating_by_designer') ? (
                  <div className="relative w-full aspect-video bg-[#0f0f0f] flex flex-col items-center justify-center text-center p-4">
                     {/* Placeholder for pending web design */}
                     <img 
                        src={generatedResult.imageUrl} // Use the draft image URL
                        alt="Pending Design" 
                        className="w-full h-auto max-h-80 object-contain mb-4 animate-pulse-slow" 
                      />
                     <h3 className="text-xl font-bold text-white mb-2">
                       {generatedResult.status === 'initial_draft_placeholder' ? t.design_status_initial_draft_placeholder :
                        generatedResult.status === 'ai_draft_generated' ? t.design_status_ai_draft_generated :
                        generatedResult.status === 'pending_designer_review' ? t.design_status_pending_review_mockup : 
                        t.design_status_generating_by_designer}
                      </h3>
                     <p className="text-gray-400 text-sm max-w-sm">{t.web_design_pending_message}</p>
                     {generatedResult.designTaskId && <p className="text-xs text-gray-500 mt-4">Task ID: {generatedResult.designTaskId}</p>}
                  </div>
                ) : (generatedResult.type === 'web' || generatedResult.type === 'brochure') && generatedResult.images && generatedResult.images.length > 0 ? (
                  <div className="relative w-full aspect-video bg-[#0f0f0f] flex items-center justify-center group">
                      
                      <img 
                        src={generatedResult.images[currentImageIndex]} 
                        alt={`Design - ${currentImageIndex + 1}`} 
                        className="max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-300"
                      />

                      {generatedResult.images.length > 1 && (
                        <>
                          <button 
                            onClick={() => setCurrentImageIndex(prev => prev === 0 ? generatedResult.images!.length - 1 : prev - 1)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-brand-green/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                            title="Previous Page"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <button 
                            onClick={() => setCurrentImageIndex(prev => prev === generatedResult.images!.length - 1 ? 0 : prev + 1)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-brand-green/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                            title="Next Page"
                          >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                          
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium text-white border border-white/10">
                             {generatedResult.type === 'web' 
                               ? (generatedResult.data.selectedPages?.[currentImageIndex] || `Page ${currentImageIndex + 1}`) 
                               : `Page ${currentImageIndex + 1}`} 
                             <span className="text-gray-400 mx-2">|</span> {currentImageIndex + 1} / {generatedResult.images.length}
                          </div>
                        </>
                      )}
                  </div>
                ) : ( // Single image for logo, identity, social
                  <div className="relative w-full aspect-square md:aspect-video bg-gray-800 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]')]}">
                     <img 
                        src={generatedResult.imageUrl} 
                        alt="Generated Design" 
                        className="max-h-full max-w-full object-contain shadow-2xl"
                      />
                  </div>
                )}

                <div className="p-8 border-t border-gray-800 bg-gray-900/50">
                   <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                      
                      <div>
                         <h3 className="text-xl font-bold text-white mb-1">{generatedResult.data.name}</h3>
                         <p className="text-sm text-gray-400">
                           {generatedResult.type === 'web' ? t.type_web : 
                            generatedResult.type === 'logo' ? t.type_logo : 
                            generatedResult.type === 'identity' ? t.type_identity :
                            generatedResult.type === 'social' ? t.type_social :
                            t.type_brochure} 
                            {generatedResult.status === 'initial_draft_placeholder' ? ` (${t.design_status_initial_draft_placeholder})` : 
                             generatedResult.status === 'ai_draft_generated' ? ` (${t.design_status_ai_draft_generated})` : 
                             generatedResult.status === 'pending_designer_review' ? ` (${t.design_status_pending_review_mockup})` : 
                             generatedResult.status === 'generating_by_designer' ? ` (${t.design_status_generating_by_designer})` : ''} 
                             • {new Date(generatedResult.timestamp).toLocaleDateString()}
                         </p>
                         {generatedResult.templateLink && (
                           <a 
                             href={generatedResult.templateLink} 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             className="text-brand-green hover:underline text-sm flex items-center gap-1 mt-2"
                           >
                             {t.result_template_link}
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                           </a>
                         )}
                      </div>

                      <div className="flex flex-wrap gap-3 justify-center">
                         <button 
                           onClick={() => handleDownload(
                              ((generatedResult.type === 'web' || generatedResult.type === 'brochure') && generatedResult.images && generatedResult.images.length > 0) && generatedResult.status === 'ready'
                                ? generatedResult.images[currentImageIndex] 
                                : generatedResult.imageUrl,
                              `GetDesign-${generatedResult.type}-${Date.now()}.png`
                           )}
                           className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors font-medium text-white"
                           disabled={generatedResult.status !== 'ready'}
                         >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            {t.download_btn}
                         </button>
                         
                         <button 
                           onClick={() => handleShare(generatedResult)}
                           className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors font-medium text-white"
                           disabled={generatedResult.status !== 'ready'}
                         >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            Share
                         </button>

                         <button 
                           onClick={() => handleWhatsAppRequest(generatedResult)}
                           className="flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold rounded-xl transition-colors shadow-lg shadow-green-900/20"
                           disabled={generatedResult.status !== 'ready'}
                         >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            {t.whatsapp_btn}
                         </button>
                      </div>
                   </div>
                   
                   <p className="mt-6 text-center text-sm text-gray-500">{t.source_file_msg}</p>
                </div>
             </div>
           </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black py-8 text-center text-gray-500 text-sm">
         <p>{t.footer_rights}</p>
      </footer>

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex justify-end">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
           <div className="relative w-80 h-full bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">{t.my_creations}</h2>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white">&times;</button>
              </div>
              
              <div className="space-y-4">
                 {history.length === 0 ? (
                   <p className="text-gray-500 text-center py-10">{t.no_creations}</p>
                 ) : (
                   history.map(item => (
                     <div key={item.id} className="bg-black/50 border border-gray-800 rounded-lg p-3 hover:border-brand-green transition-colors cursor-pointer group" onClick={() => loadFromHistory(item)}>
                        <img 
                          src={item.imageUrl || GENERIC_WEB_DRAFT_SVG_DATA_URL} // Use placeholder for null/empty
                          alt={item.type} 
                          className="w-full h-32 object-cover rounded-md mb-3" 
                        />
                        <h4 className="font-bold text-sm text-white mb-1">{item.data.name}</h4>
                        <div className="flex justify-between items-center">
                           <span className="text-xs text-brand-green uppercase">
                              {item.type}
                              {item.status === 'initial_draft_placeholder' && ` (${t.design_status_initial_draft_placeholder})`}
                              {item.status === 'ai_draft_generated' && ` (${t.design_status_ai_draft_generated})`}
                              {item.status === 'pending_designer_review' && ` (${t.design_status_pending_review_mockup})`}
                              {item.status === 'generating_by_designer' && ` (${t.design_status_generating_by_designer})`}
                           </span>
                           <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                        <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             const newHist = history.filter(h => h.id !== item.id);
                             setHistory(newHist);
                             try {
                               localStorage.setItem('design_history', JSON.stringify(newHist));
                             } catch(err) {
                               console.error("Failed to update storage", err);
                             }
                           }}
                           className="text-xs text-red-900 group-hover:text-red-500 mt-2 block w-full text-right"
                        >
                          {t.delete_design}
                        </button>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowContactModal(false)} />
           <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
              <h2 className="text-2xl font-bold text-white mb-2 text-center">{t.contact_modal_title}</h2>
              <p className="text-gray-400 text-center mb-6 text-sm">{t.contact_modal_subtitle}</p>
              
              <form onSubmit={handleContactSubmit} className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">{t.contact_name}</label>
                   <input 
                      type="text" 
                      value={contactDetails.name}
                      onChange={(e) => setContactDetails(prev => ({...prev, name: e.target.value}))}
                      className={`w-full bg-black/50 border rounded-lg p-3 text-white focus:outline-none ${validationErrors.name ? 'border-red-500' : 'border-gray-700 focus:border-brand-green'}`}
                    />
                    {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">{t.contact_company}</label>
                   <input 
                      type="text" 
                      value={contactDetails.company}
                      onChange={(e) => setContactDetails(prev => ({...prev, company: e.target.value}))}
                      className={`w-full bg-black/50 border rounded-lg p-3 text-white focus:outline-none ${validationErrors.company ? 'border-red-500' : 'border-gray-700 focus:border-brand-green'}`}
                    />
                    {validationErrors.company && <p className="text-red-500 text-xs mt-1">{validationErrors.company}</p>}
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">{t.contact_email}</label>
                   <input 
                      type="email" 
                      value={contactDetails.email}
                      onChange={(e) => setContactDetails(prev => ({...prev, email: e.target.value}))}
                      className={`w-full bg-black/50 border rounded-lg p-3 text-white focus:outline-none ${validationErrors.email ? 'border-red-500' : 'border-gray-700 focus:border-brand-green'}`}
                    />
                    {validationErrors.email && <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>}
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">{t.contact_phone}</label>
                   <input 
                      type="tel" 
                      value={contactDetails.phone}
                      onChange={(e) => setContactDetails(prev => ({...prev, phone: e.target.value}))}
                      className={`w-full bg-black/50 border rounded-lg p-3 text-white focus:outline-none ${validationErrors.phone ? 'border-red-500' : 'border-gray-700 focus:border-brand-green'}`}
                    />
                    {validationErrors.phone && <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>}
                 </div>

                 {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                 <button 
                   type="submit"
                   className="w-full bg-brand-green hover:bg-lime-500 text-black font-bold py-3 rounded-xl transition-colors mt-2"
                 >
                   {t.contact_submit}
                 </button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}

export default App;