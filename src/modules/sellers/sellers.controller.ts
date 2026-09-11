import { Request, Response } from "express";
import { SellersService } from "./sellers.service";
import { sendSuccess } from "../../shared/utils/response";
import { UnauthorizedError } from "../../shared/errors/errors";

export class SellersController {
  public static onboard = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const result = await SellersService.startOnboarding(req.user.id, req.body);
    sendSuccess(res, result, 201, "Seller onboarding started");
  };

  public static getMe = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const seller = await SellersService.getProfile(req.user.id);
    sendSuccess(res, seller);
  };

  public static getStripeStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const status = await SellersService.getStripeStatus(req.user.id);
    sendSuccess(res, status);
  };

  public static refreshStripe = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const result = await SellersService.refreshOnboardingLink(req.user.id);
    sendSuccess(res, result);
  };

  public static simulateOnboard = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await SellersService.simulateOnboardingCompletion(req.user.id);
    sendSuccess(res, updated, 200, "Simulated Stripe onboarding completed successfully");
  };

  // Admin handlers
  public static adminList = async (req: Request, res: Response): Promise<void> => {
    const status = req.query.status as any;
    const sellers = await SellersService.adminListSellers(status);
    sendSuccess(res, sellers);
  };

  public static adminApprove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const approved = await SellersService.adminApproveSeller(req.params.id, req.user.id);
    sendSuccess(res, approved, 200, "Seller approved successfully");
  };

  public static adminReject = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const rejected = await SellersService.adminRejectSeller(
      req.params.id,
      req.user.id,
      req.body.reason
    );
    sendSuccess(res, rejected, 200, "Seller rejected");
  };
}
