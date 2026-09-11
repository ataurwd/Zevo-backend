import { Request, Response } from "express";
import { StoresService } from "./stores.service";
import { sendSuccess, sendPaginated } from "../../shared/utils/response";
import { parsePagination, buildPaginationMeta } from "../../shared/utils/pagination";
import { UnauthorizedError, BadRequestError } from "../../shared/errors/errors";

export class StoresController {
  public static list = async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await StoresService.listStores(skip, limit);
    sendPaginated(res, items, buildPaginationMeta(total, page, limit));
  };

  public static getBySlug = async (req: Request, res: Response): Promise<void> => {
    const store = await StoresService.getStoreBySlug(req.params.slug);
    sendSuccess(res, store);
  };

  public static create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const created = await StoresService.createStore(req.user.id, req.body);
    sendSuccess(res, created, 201, "Store created successfully");
  };

  public static getMine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const store = await StoresService.getMyStore(req.user.id);
    sendSuccess(res, store);
  };

  public static updateMine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await StoresService.updateMyStore(req.user.id, req.body);
    sendSuccess(res, updated, 200, "Store settings updated successfully");
  };

  public static uploadLogo = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    if (!req.file) throw new BadRequestError("Logo image file is required");

    const logoUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await StoresService.updateLogo(req.user.id, logoUrl);
    sendSuccess(res, updated, 200, "Store logo uploaded successfully");
  };

  public static uploadBanner = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    if (!req.file) throw new BadRequestError("Banner image file is required");

    const bannerUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await StoresService.updateBanner(req.user.id, bannerUrl);
    sendSuccess(res, updated, 200, "Store banner uploaded successfully");
  };
}
