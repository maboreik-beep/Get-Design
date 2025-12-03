
// services/geminiService.ts
import { BusinessData, DesignType, GeneratedResult, GeneratedResultStatus } from '../types';
// Removed unused import: GENERIC_WEB_DRAFT_SVG_DATA_URL

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
 * Calls the backend API to generate a design, or create a design task for web designs.
 */
export async function generateDesign(
  designType: DesignType,
  inputMode: 'form' | 'zip', // Used to determine how to send files
  businessData: BusinessData,
  logoBase64: string | null,
  onStatusUpdate: (status: string) => void,
  zipFile: File | null,
): Promise<GeneratedResult> {
  onStatusUpdate("Initializing AI design engine...");

  const formData = new FormData();
  formData.append('type', designType);
  formData.append('businessData', JSON.stringify(businessData));

  // Explicitly use inputMode for clarity and to resolve TS6133
  if (inputMode === 'zip' && zipFile) { 
    formData.append('zipFile', zipFile);
    onStatusUpdate("Uploading assets from ZIP...");
  } else if (inputMode === 'form') {
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
  let statusInterval: number | null = null; 

  if (designType !== 'web') { // Only show progress for immediate generations
    statusInterval = setInterval(() => {
      if (messageIndex < statusMessages.length) {
        onStatusUpdate(statusMessages[messageIndex]);
        messageIndex++;
      } else {
        clearInterval(statusInterval!);
      }
    }, 5000); // Update status every 5 seconds
  }

  try {
    const endpoint = designType === 'web' ? '/api/design-tasks' : '/api/generate-design';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData, // FormData automatically sets 'Content-Type': 'multipart/form-data'
    });

    if (statusInterval) clearInterval(statusInterval); // Stop status updates once response is received
    await handleBackendResponseError(response); // Handle HTTP errors
    const result: GeneratedResult = await response.json();
    
    if (designType === 'web') {
      onStatusUpdate("Website design request submitted (draft provided).");
    } else {
      onStatusUpdate("Design complete!");
    }
    return result;

  } catch (error: any) {
    if (statusInterval) clearInterval(statusInterval); // Stop status updates on error
    onStatusUpdate("Error during generation.");
    console.error("Error generating design:", error);
    throw error;
  }
}

/**
 * Admin function to trigger AI generation for a pending web design task.
 */
export async function triggerWebDesignGeneration(
  taskId: number,
  onStatusUpdate: (status: string) => void,
): Promise<GeneratedResult> {
  onStatusUpdate("AI generation for website design started...");

  const token = localStorage.getItem('adminToken');
  if (!token) {
    throw new Error("Admin authentication token not found.");
  }

  const statusMessages = [
    "Processing task details...",
    "Preparing AI model for website generation...",
    "Generating homepage concept...",
    "Generating additional page layouts...",
    "Refining website mockups...",
    "Finalizing image renders...",
    "Website design concept ready!",
  ];
  let messageIndex = 0;
  const statusInterval: number = setInterval(() => { 
    if (messageIndex < statusMessages.length) {
      onStatusUpdate(statusMessages[messageIndex]);
      messageIndex++;
    } else {
      clearInterval(statusInterval);
    }
  }, 7000); // Update status every 7 seconds for potentially longer web generation

  try {
    const response = await fetch(`/api/admin/design-tasks/${taskId}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // 'Content-Type': 'application/json' is not needed for a POST without body,
        // but if it were to send any flags, it would be here.
      },
    });

    clearInterval(statusInterval);
    await handleBackendResponseError(response);
    const result: GeneratedResult = await response.json();
    onStatusUpdate("Website design generation completed!");
    return result;
  } catch (error: any) {
    clearInterval(statusInterval);
    onStatusUpdate("Error during website generation.");
    console.error("Error triggering web design generation:", error);
    throw error;
  }
}

/**
 * Fetches the current status and image URL of a generated design.
 * Used by frontend polling for draft updates.
 */
export async function fetchDesignStatus(designId: number): Promise<{imageUrl: string; status: GeneratedResultStatus}> {
  try {
    const response = await fetch(`/api/generated-designs/${designId}/status`);
    await handleBackendResponseError(response);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching design status:", error);
    throw error;
  }
}