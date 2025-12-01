// services/geminiService.ts
import { BusinessData, DesignType, GeneratedResult } from '../types';

/**
 * centralized error handler for fetch API responses from backend
 */
function handleBackendResponseError(response: Response, errorData: any): never {
  const msg = errorData.error || response.statusText || "An unknown error occurred.";
  console.error("Backend Error Details:", errorData);

  // Specific error messages passed from the backend
  if (msg.includes("API Key configuration error on server")) {
    throw new Error("API Key configuration error on server. Please contact support.");
  }
  
  if (msg.includes("Usage Limit Exceeded")) {
    throw new Error("Usage Limit Exceeded: The AI service quota has been reached. Please wait a moment and try again.");
  }

  if (msg.includes("Service Error: Google AI is currently experiencing high traffic.")) {
    throw new Error("Service Error: Google AI is currently experiencing high traffic. Please retry in a moment.");
  }
  
  if (msg.includes("Content Filtered")) {
    throw new Error("Content Filtered: The request was blocked by safety settings. Please modify your business description.");
  }

  if (msg.includes("Network Error: Server failed to connect to AI service")) {
    throw new Error("Network Error: Server failed to connect to AI service. Please check your internet connection.");
  }
  if (msg.includes("Server API Key not configured.")) {
    throw new Error("Service Unavailable: The AI backend is not fully configured. Please contact support.");
  }
  if (msg.includes("Zip file size exceeds limit")) {
    throw new Error("Zip file size exceeds limit. Please upload a smaller file.");
  }


  throw new Error(msg);
}

/**
 * Main function to generate design
 * Now calls the backend proxy.
 */
export async function generateDesign(
  type: DesignType, 
  _mode: 'text' | 'image', // Mode is now handled by zipFile presence
  data: BusinessData,
  logoBase64?: string,
  brochureBase64?: string, 
  onStatusUpdate?: (status: string) => void,
  zipFile?: File | null // New parameter for zip file upload
): Promise<GeneratedResult> {
  
  const backendEndpoint = '/api/generate-design'; 
  onStatusUpdate?.(`Sending request to AI Designer...`);

  try {
    let response: Response;
    if (zipFile) {
      const formData = new FormData();
      formData.append('zipFile', zipFile);
      formData.append('type', type);
      formData.append('businessData', JSON.stringify(data)); // Stringify complex objects

      response = await fetch(backendEndpoint, {
        method: 'POST',
        // When sending FormData, DO NOT set Content-Type header manually.
        // The browser will set it correctly with the boundary.
        body: formData,
      });
    } else {
      // Original JSON body for manual form input
      response = await fetch(backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          businessData: data,
          logoBase64,
          brochureBase64,
        }),
      });
    }

    const responseData = await response.json();

    if (!response.ok) {
      handleBackendResponseError(response, responseData); // Throws specific error
    }

    onStatusUpdate?.("Design received!"); // Final status update
    return responseData as GeneratedResult;

  } catch (error: any) {
    // If the error is already a processed one from handleBackendResponseError, re-throw.
    // Otherwise, it's a network error before hitting the backend or an unknown error.
    if (error.message.includes("API Key configuration error on server") || 
        error.message.includes("Usage Limit Exceeded") ||
        error.message.includes("Service Error: Google AI is currently experiencing high traffic") ||
        error.message.includes("Content Filtered") ||
        error.message.includes("Network Error: Server failed to connect to AI service") ||
        error.message.includes("Service Unavailable: The AI backend is not fully configured.") ||
        error.message.includes("Zip file size exceeds limit")) {
      throw error;
    }
    // Generic frontend network error or unexpected client-side error
    throw new Error(`Frontend Network Error: ${error.message || "Could not connect to the backend service."}`);
  }
}