const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PredictionResponse {
  success: boolean;
  message?: string;
  is_mock?: boolean;
  error?: string;
  data?: {
    sensor: {
      temperature: number;
      humidity: number;
    };
    prediction: {
      diseaseLabel: string;
      confidence: number;
      needsReview: boolean;
      isDisease: boolean;
      imageUrl: string;
      timestamp?: string;
    };
  };
}

export async function checkBackendStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: "GET",
      // Use a short timeout or just let fetch fail normally if offline
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function uploadPredict(
  temperature: number,
  humidity: number,
  imageFile: File
): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append("temperature", temperature.toString());
  formData.append("humidity", humidity.toString());
  formData.append("image", imageFile);

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: PredictionResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Prediction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
