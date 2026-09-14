import { Router, Request, Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess, sendError } from "../../shared/utils/response";
import { UploadsService, MAX_FILE_SIZE, MAX_IMAGES } from "./uploads.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

export const uploadsRouter = Router();

// 1. Single Image Upload
uploadsRouter.post(
  "/image",
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return sendError(res, "BAD_REQUEST", "No image file provided", 400);
    }

    const result = await UploadsService.uploadToImgBB(
      req.file.buffer,
      req.file.originalname
    );

    return sendSuccess(res, result, 201, "Image uploaded to ImgBB successfully");
  })
);

// 2. Multi-Image Upload (Max 5 images)
uploadsRouter.post(
  "/images",
  upload.array("images", MAX_IMAGES),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return sendError(res, "BAD_REQUEST", "No image files provided", 400);
    }

    if (files.length > MAX_IMAGES) {
      return sendError(
        res,
        "BAD_REQUEST",
        `You can upload a maximum of ${MAX_IMAGES} images at once`,
        400
      );
    }

    const uploadPromises = files.map((f) =>
      UploadsService.uploadToImgBB(f.buffer, f.originalname)
    );
    const results = await Promise.all(uploadPromises);

    return sendSuccess(
      res,
      {
        items: results,
        urls: results.map((r) => r.display_url),
      },
      201,
      `${results.length} images uploaded to ImgBB successfully`
    );
  })
);
