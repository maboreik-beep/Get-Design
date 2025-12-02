import React, { useRef, useState } from 'react';

interface FileUploadProps<T> {
  label: string;
  // If `multiple` is true, `data` will be `T[]`. If `multiple` is false, `data` will be `T | null`.
  onFileSelect: (data: T | T[] | null) => void;
  accept?: string;
  multiple?: boolean; // New prop for multiple file selection
  returnFileObject?: boolean; // If true, T is File or File[]
  disabled?: boolean;
}

export const FileUpload = <T extends string | File = string>({ 
  label, 
  onFileSelect, 
  accept = "image/png, image/jpeg, image/jpg", 
  multiple = false, // Default to single file upload
  returnFileObject = false, 
  disabled = false 
}: FileUploadProps<T>) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]); // To display names for multiple files
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (returnFileObject) {
        resolve(file as T); // Return raw File object, cast as T
        return;
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const dataUrl = readerEvent.target?.result as string;
        const mimeType = file.type;

        if (mimeType.startsWith('image/')) {
          const img = new Image();
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
              // Return compressed image base64, cast as T
              resolve(canvas.toDataURL('image/jpeg', 0.8) as T); 
            } else {
              reject(new Error("Could not get canvas context"));
            }
          };
          img.onerror = reject;
          img.src = dataUrl;
        } else {
          // For non-image files (PDF, DOCX), return full data URL, cast as T
          resolve(dataUrl as T);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setPreview(null);
      setFileNames([]);
      // Pass null for single file selection, empty array for multiple.
      onFileSelect(multiple ? [] : null); 
      return;
    }

    // Convert FileList to an array of File objects for easier and safer typing
    const fileListArray: File[] = Array.from(files);
    setFileNames(fileListArray.map(f => f.name));
    setPreview(null); // Clear image preview for multi-file/non-image uploads

    if (multiple) {
      const processedResults: T[] = [];
      for (const file of fileListArray) {
        try {
          const result = await processFile(file);
          processedResults.push(result);
        } catch (error: unknown) {
          const fileName = (error instanceof Error && file.name) ? file.name : 'Unknown File'; // Safely access file.name
          console.error(`Error processing file ${fileName}:`, error instanceof Error ? error.message : String(error));
        }
      }
      onFileSelect(processedResults); 
    } else {
      // Single file logic (existing)
      try {
        const file: File = fileListArray[0]; 
        const result = await processFile(file); // result is now of type T
        if (typeof result === 'string' && file.type.startsWith('image/')) {
          setPreview(result); // Show image preview for single image
        }
        onFileSelect(result); 
      } catch (error: unknown) {
        const fileName = (error instanceof Error && fileListArray[0]?.name) ? fileListArray[0].name : 'Unknown File'; // Safely access file.name
        console.error(`Error processing single file ${fileName}:`, error instanceof Error ? error.message : String(error));
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
        multiple={multiple} // Apply multiple prop to input
      />
      
      {/* Conditional rendering for preview and labels */}
      {preview && !multiple && !returnFileObject ? ( // Single image preview
        <img src={preview} alt="File Preview" className="h-full w-auto object-contain rounded-md" />
      ) : fileNames.length > 0 ? ( // Display file names for multiple/non-image files
        <div className="flex flex-col items-center justify-center h-full max-h-full overflow-y-auto">
          <svg className={`w-12 h-12 mb-4 transition-colors ${disabled ? 'text-gray-700' : 'text-gray-400 group-hover:text-brand-green'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className={`font-medium transition-colors ${disabled ? 'text-gray-600' : 'text-gray-400 group-hover:text-white'} mb-2`}>
            {fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files selected`}
          </p>
          {fileNames.length > 1 && (
            <ul className="text-xs text-gray-500 max-h-16 overflow-y-auto custom-scrollbar">
              {fileNames.map((name, index) => <li key={index}>{name}</li>)}
            </ul>
          )}
        </div>
      ) : ( // Default upload state
        <>
          <svg className={`w-12 h-12 mb-4 transition-colors ${disabled ? 'text-gray-700' : 'text-gray-400 group-hover:text-brand-green'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className={`font-medium transition-colors ${disabled ? 'text-gray-600' : 'text-gray-400 group-hover:text-white'}`}>
            {label}
          </p>
        </>
      )}
    </div>
  );
};