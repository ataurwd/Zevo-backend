import { Request, Response } from "express";
import { CategoriesService } from "./categories.service";
import { sendSuccess } from "../../shared/utils/response";

export class CategoriesController {
  public static getTree = async (_req: Request, res: Response): Promise<void> => {
    const tree = await CategoriesService.getCategoryTree();
    sendSuccess(res, tree);
  };

  public static getBySlug = async (req: Request, res: Response): Promise<void> => {
    const result = await CategoriesService.getBySlug(req.params.slug);
    sendSuccess(res, result);
  };

  public static create = async (req: Request, res: Response): Promise<void> => {
    const created = await CategoriesService.createCategory(req.body);
    sendSuccess(res, created, 201, "Category created successfully");
  };

  public static update = async (req: Request, res: Response): Promise<void> => {
    const updated = await CategoriesService.updateCategory(req.params.id, req.body);
    sendSuccess(res, updated, 200, "Category updated successfully");
  };

  public static delete = async (req: Request, res: Response): Promise<void> => {
    await CategoriesService.deleteCategory(req.params.id);
    sendSuccess(res, { deleted: true }, 200, "Category deleted successfully");
  };
}
