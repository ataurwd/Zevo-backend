import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/response";
import { PaymentService } from "./payment.service";
import { BadRequestError } from "../../shared/errors/errors";

export class PaymentController {
  public static handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = (req.headers["stripe-signature"] as string) || "";
    const rawBody = req.rawBody || (req as any).body;

    if (!rawBody) {
      throw new BadRequestError("Missing webhook payload body");
    }

    const result = await PaymentService.processWebhook(rawBody, signature);
    res.status(200).json(result);
  });

  public static listCustomerPayments = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const status = req.query.status as string | undefined;

    const userRole = req.user?.role;
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") {
      const result = await PaymentService.getAllPayments(page, limit, status);
      return sendSuccess(res, result, 200, "All payments retrieved successfully");
    }

    const customerId = req.user!.id;
    const result = await PaymentService.getCustomerPayments(customerId, page, limit);
    sendSuccess(res, result, 200, "Payments retrieved successfully");
  });

  public static adminListAllPayments = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const status = req.query.status as string | undefined;

    const result = await PaymentService.getAllPayments(page, limit, status);
    sendSuccess(res, result, 200, "All payments retrieved successfully");
  });

  public static getPaymentById = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.user!.id;
    const paymentId = req.params.id;

    const result = await PaymentService.getPaymentById(customerId, paymentId);
    sendSuccess(res, result, 200, "Payment details retrieved successfully");
  });

  public static adminRefund = asyncHandler(async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    const adminUserId = req.user!.id;

    const result = await PaymentService.initiateRefund(paymentId, req.body, adminUserId);
    sendSuccess(res, result, 200, "Refund processed successfully");
  });
}
