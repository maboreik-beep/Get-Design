// services/geminiService.ts
import { BusinessData, DesignType, GeneratedResult } from '../types';

/**
 * Centralized error handler for fetch API responses from backend.
 */
async function handleBackendResponseError(response: Response) {
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }
  return response;
}

/**
 * Calls the backend API to generate a design.
 */
export async function generateDesign(
  designType: DesignType,
  mode: 'text' | 'zip', // Not directly used in frontend but kept for consistency if backend uses it
  businessData: BusinessData,
  logoBase64: string | null,
  onStatusUpdate: (status: string) => void,
  zipFile: File | null,
): Promise<GeneratedResult> {
  onStatusUpdate("Initializing AI design engine...");

  const formData = new FormData();
  formData.append('type', designType);
  formData.append('businessData', JSON.stringify(businessData));

  if (zipFile) {
    formData.append('zipFile', zipFile);
    onStatusUpdate("Uploading assets from ZIP...");
  } else {
    // Only append logoBase64 and brochureBase64 if in form mode
    if (logoBase64) {
      formData.append('logoBase64', logoBase64);
    }
    // `brochureBase64` is part of `businessData` for form mode
    // If it's an array, append each as a separate part (backend expects this for multiple files)
    if (businessData.brochureBase64) {
      const brochureFiles = Array.isArray(businessData.brochureBase64) ? businessData.brochureBase64 : [businessData.brochureBase64];
      brochureFiles.forEach((file, index) => {
        if (file) {
          formData.append(`brochureBase64[${index}]`, file);
        }
      });
    }
  }

  // Simulate progress updates (backend would ideally send real-time updates)
  const statusMessages = [
    "Analyzing business requirements...",
    "Selecting optimal design templates...",
    "Generating initial design concepts...",
    "Refining visual elements and typography...",
    "Adding branding and content...",
    "Finalizing image details...",
    "Almost done, just a moment!",
  ];
  let messageIndex = 0;
  const statusInterval = setInterval(() => {
    if (messageIndex < statusMessages.length) {
      onStatusUpdate(statusMessages[messageIndex]);
      messageIndex++;
    } else {
      // Loop or stop
      clearInterval(statusInterval);
    }
  }, 5000); // Update status every 5 seconds

  try {
    const response = await fetch('/api/generate-design', {
      method: 'POST',
      body: formData, // FormData automatically sets 'Content-Type': 'multipart/form-data'
    });

    clearInterval(statusInterval); // Stop status updates once response is received
    await handleBackendResponseError(response); // Handle HTTP errors
    const result: GeneratedResult = await response.json();
    onStatusUpdate("Design complete!");
    return result;

  } catch (error: any) {
    clearInterval(statusInterval); // Stop status updates on error
    onStatusUpdate("Error during generation.");
    console.error("Error generating design:", error);
    throw error;
  }
}