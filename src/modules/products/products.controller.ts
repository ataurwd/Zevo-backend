import { Request, Response } from "express";
import { ProductsService } from "./products.service";
import { sendSuccess, sendPaginated } from "../../shared/utils/response";
import { buildPaginationMeta } from "../../shared/utils/pagination";
import { UnauthorizedError } from "../../shared/errors/errors";

export class ProductsController {
  // Public
  public static browse = async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(String(req.query.page), 10) || 1;
    const limit = parseInt(String(req.query.limit), 10) || 20;

    const { items, total } = await ProductsService.browsePublic({
      q: req.query.q as string,
      category: req.query.category as string,
      store: req.query.store as string,
      min_price: req.query.min_price ? Number(req.query.min_price) : undefined,
      max_price: req.query.max_price ? Number(req.query.max_price) : undefined,
      rating: req.query.rating ? Number(req.query.rating) : undefined,
      sort: req.query.sort as any,
      page,
      limit,
    });

    sendPaginated(res, items, buildPaginationMeta(total, page, limit));
  };

  public static getPublicDetail = async (req: Request, res: Response): Promise<void> => {
    const product = await ProductsService.getProductPublicById(req.params.id);
    sendSuccess(res, product);
  };

  // Seller
  public static listMine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const products = await ProductsService.getSellerProducts(req.user.id);
    sendSuccess(res, products);
  };

  public static getMine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const product = await ProductsService.getSellerProductById(req.user.id, req.params.id);
    sendSuccess(res, product);
  };

  public static create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const product = await ProductsService.createProduct(req.user.id, req.body);
    sendSuccess(res, product, 201, "Product created in draft status");
  };

  public static update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await ProductsService.updateProduct(req.user.id, req.params.id, req.body);
    sendSuccess(res, updated, 200, "Product updated successfully");
  };

  public static delete = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await ProductsService.deleteProduct(req.user.id, req.params.id);
    sendSuccess(res, { deleted: true }, 200, "Product deleted");
  };

  public static addVariant = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await ProductsService.addVariant(req.user.id, req.params.id, req.body);
    sendSuccess(res, updated, 201, "Variant added successfully");
  };

  public static submitForReview = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await ProductsService.submitForReview(req.user.id, req.params.id);
    sendSuccess(res, updated, 200, "Product submitted for administrative review");
  };

  // Admin
  public static adminList = async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(String(req.query.page), 10) || 1;
    const limit = parseInt(String(req.query.limit), 10) || 20;
    const status = req.query.status as string;

    const { items, total } = await ProductsService.adminList(status, (page - 1) * limit, limit);
    sendPaginated(res, items, buildPaginationMeta(total, page, limit));
  };

  public static adminApprove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const approved = await ProductsService.adminApprove(req.params.id, req.user.id);
    sendSuccess(res, approved, 200, "Product approved and published");
  };

  public static adminReject = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const rejected = await ProductsService.adminReject(req.params.id, req.user.id, req.body.reason);
    sendSuccess(res, rejected, 200, "Product rejected");
  };

  public static adminGetDetail = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const product = await ProductsService.adminGetProductById(req.params.id);
    sendSuccess(res, product);
  };

  public static adminCreate = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const created = await ProductsService.adminCreate(req.user.id, req.body);
    sendSuccess(res, created, 201, "Product created successfully");
  };

  public static adminUpdate = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await ProductsService.adminUpdate(req.params.id, req.user.id, req.body);
    sendSuccess(res, updated, 200, "Product updated successfully");
  };

  public static adminDelete = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await ProductsService.adminDelete(req.params.id, req.user.id);
    sendSuccess(res, { deleted: true }, 200, "Product deleted successfully");
  };
}
