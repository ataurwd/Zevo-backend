import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/response";
import { OrderService } from "./order.service";

export class OrderController {
  // Customer Handlers
  public static createOrder = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const result = await OrderService.createOrder(customerId, req.body);
    sendSuccess(res, result, 201, "Order created successfully");
  });

  public static listCustomerOrders = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status = req.query.status as string | undefined;

    const result = await OrderService.getCustomerOrders(customerId, page, limit, status);
    sendSuccess(res, result, 200, "Orders retrieved successfully");
  });

  public static getCustomerOrder = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const orderId = req.params.id;
    const result = await OrderService.getCustomerOrderById(customerId, orderId);
    sendSuccess(res, result, 200, "Order retrieved successfully");
  });

  public static cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const orderId = req.params.id;
    const { reason } = req.body || {};
    const result = await OrderService.cancelOrder(customerId, orderId, reason);
    sendSuccess(res, result, 200, "Order cancelled successfully");
  });

  // Seller Handlers
  public static listSellerSubOrders = asyncHandler(async (req: Request, res: Response) => {
    const sellerUserId = req.user!.id;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status = req.query.status as string | undefined;

    const result = await OrderService.getSellerSubOrders(sellerUserId, page, limit, status);
    sendSuccess(res, result, 200, "Seller sub-orders retrieved successfully");
  });

  public static getSellerSubOrder = asyncHandler(async (req: Request, res: Response) => {
    const sellerUserId = req.user!.id;
    const subOrderId = req.params.subOrderId;
    const result = await OrderService.getSellerSubOrderById(sellerUserId, subOrderId);
    sendSuccess(res, result, 200, "Sub-order retrieved successfully");
  });

  public static confirmSubOrder = asyncHandler(async (req: Request, res: Response) => {
    const sellerUserId = req.user!.id;
    const subOrderId = req.params.subOrderId;
    const result = await OrderService.updateSubOrderStatus(sellerUserId, subOrderId, "confirmed");
    sendSuccess(res, result, 200, "Sub-order confirmed successfully");
  });

  public static prepareSubOrder = asyncHandler(async (req: Request, res: Response) => {
    const sellerUserId = req.user!.id;
    const subOrderId = req.params.subOrderId;
    const result = await OrderService.updateSubOrderStatus(sellerUserId, subOrderId, "preparing");
    sendSuccess(res, result, 200, "Sub-order status updated to preparing");
  });

  public static readySubOrder = asyncHandler(async (req: Request, res: Response) => {
    const sellerUserId = req.user!.id;
    const subOrderId = req.params.subOrderId;
    const result = await OrderService.updateSubOrderStatus(sellerUserId, subOrderId, "ready_for_pickup");
    sendSuccess(res, result, 200, "Sub-order status updated to ready for pickup");
  });

  // Admin Handlers
  public static adminListAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status = req.query.status as string | undefined;

    const result = await OrderService.adminListAllOrders(page, limit, status);
    sendSuccess(res, result, 200, "All orders retrieved successfully");
  });

  public static adminGetOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    const result = await OrderService.adminGetOrderById(orderId);
    sendSuccess(res, result, 200, "Order retrieved successfully");
  });

  public static adminCancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    const adminUserId = req.user!.id;
    const { reason } = req.body || {};
    const result = await OrderService.adminCancelOrder(orderId, reason, adminUserId);
    sendSuccess(res, result, 200, "Order cancelled by administrator");
  });

  public static adminListAllSubOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status = req.query.status as string | undefined;

    const result = await OrderService.adminListAllSubOrders(page, limit, status);
    sendSuccess(res, result, 200, "All sub-orders retrieved successfully");
  });
}
