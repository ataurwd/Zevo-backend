import { logger } from "../../infrastructure/logger";

const DEFAULT_IMGBB_API_KEY = "88bb5a691cfe76f4e760e5de74694655";
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_IMAGES = 5;

export interface ImgBBUploadResult {
  url: string;
  display_url: string;
  thumb_url?: string;
  delete_url?: string;
  width?: number;
  height?: number;
  size?: number;
}

export class UploadsService {
  public static async uploadToImgBB(
    fileBuffer: Buffer,
    filename: string,
    customApiKey?: string
  ): Promise<ImgBBUploadResult> {
    if (fileBuffer.length > MAX_FILE_SIZE) {
      const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
      throw new Error(`File "${filename}" is ${sizeMB}MB, exceeding the 2MB limit.`);
    }

    const apiKey = (customApiKey || process.env.IMGBB_API_KEY || DEFAULT_IMGBB_API_KEY).trim();
    if (!apiKey) {
      throw new Error("ImgBB API key is not configured.");
    }

    const base64Data = fileBuffer.toString("base64");
    const formData = new FormData();
    formData.append("image", base64Data);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    const resJson: any = await response.json();

    if (!response.ok || !resJson.success || !resJson.data?.url) {
      const msg = resJson?.error?.message || "Failed to upload image to ImgBB";
      logger.error({ resJson }, "ImgBB upload error");
      throw new Error(`ImgBB API Error: ${msg}`);
    }

    return {
      url: resJson.data.url,
      display_url: resJson.data.display_url || resJson.data.url,
      thumb_url: resJson.data.thumb?.url,
      delete_url: resJson.data.delete_url,
      width: resJson.data.width,
      height: resJson.data.height,
      size: resJson.data.size,
    };
  }
}
