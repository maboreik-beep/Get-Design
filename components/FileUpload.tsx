import React, { useRef, useState } from 'react';

// Make FileUploadProps generic over TData which can be string or File
interface FileUploadProps<TData extends string | File> {
  label: string;
  onFileSelect: (data: TData) => void; 
  accept?: string;
  returnFileObject?: boolean; // This prop now guides the internal logic
  disabled?: boolean;
}

// Update the component definition to be generic, defaulting TData to string
export const FileUpload = <TData extends string | File = string>({ 
  label, 
  onFileSelect, 
  accept = "image/png, image/jpeg, image/jpg", 
  returnFileObject = false, // Keep default value here, it's an internal flag
  disabled = false 
}: FileUploadProps<TData>) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (returnFileObject) {
        // For zip files or when raw file object is needed
        setPreview(null); // No image preview for zip
        // Cast onFileSelect to accept File, as we know returnFileObject is true
        (onFileSelect as (data: File) => void)(file); 
      } else {
        // For image files, process to base64 and create preview
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (readerEvent) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              setPreview(dataUrl);
              
              const rawBase64 = dataUrl.split(',')[1];
              // Cast onFileSelect to accept string, as we know returnFileObject is false
              (onFileSelect as (data: string) => void)(rawBase64); 
            }
          };
          img.src = readerEvent.target?.result as string;
        };
        
        reader.readAsDataURL(file);
      }
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center group h-48
        ${disabled ? 'border-gray-800 bg-gray-900 text-gray-600 cursor-not-allowed' : 'border-gray-600 hover:border-brand-green bg-brand-gray'}`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept={accept} 
        className="hidden" 
        disabled={disabled}
      />
      
      {preview && !returnFileObject ? ( // Only show image preview if it's an image upload
        <img src={preview} alt="File Preview" className="h-full w-auto object-contain rounded-md" />
      ) : (
        <>
          <svg className={`w-12 h-12 mb-4 transition-colors ${disabled ? 'text-gray-700' : 'text-gray-400 group-hover:text-brand-green'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className={`font-medium transition-colors ${disabled ? 'text-gray-600' : 'text-gray-400 group-hover:text-white'}`}>
            {label}
          </p>
        </>
      )}
    </div>
  );
};