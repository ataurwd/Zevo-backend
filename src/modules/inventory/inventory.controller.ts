import { Request, Response } from "express";
import { InventoryService } from "./inventory.service";
import { sendSuccess, sendPaginated } from "../../shared/utils/response";
import { buildPaginationMeta } from "../../shared/utils/pagination";
import { UnauthorizedError } from "../../shared/errors/errors";

export class InventoryController {
  public static listSellerInventory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");

    const page = parseInt(String(req.query.page), 10) || 1;
    const limit = parseInt(String(req.query.limit), 10) || 50;
    const search = req.query.search as string;
    const low_stock_only = req.query.low_stock_only === "true";

    const { items, total } = await InventoryService.getSellerInventory(req.user.id, {
      page,
      limit,
      search,
      low_stock_only,
    });

    sendPaginated(res, items, buildPaginationMeta(total, page, limit));
  };

  public static getBySku = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const item = await InventoryService.getInventoryBySku(req.user.id, req.params.sku);
    sendSuccess(res, item);
  };

  public static updateStock = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await InventoryService.updateStock(
      req.user.id,
      req.params.sku,
      req.body
    );
    sendSuccess(res, updated, 200, "Inventory stock updated successfully");
  };

  public static setThreshold = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await InventoryService.setThreshold(
      req.user.id,
      req.params.sku,
      req.body
    );
    sendSuccess(res, updated, 200, "Low stock threshold updated");
  };

  public static listTransactions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const limit = parseInt(String(req.query.limit), 10) || 50;
    const txs = await InventoryService.getTransactions(req.user.id, limit);
    sendSuccess(res, txs);
  };

  public static adminListAll = async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(String(req.query.page), 10) || 1;
    const limit = parseInt(String(req.query.limit), 10) || 50;

    const { items, total } = await InventoryService.adminListAll(page, limit);
    sendPaginated(res, items, buildPaginationMeta(total, page, limit));
  };
}
