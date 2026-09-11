import { Request, Response, NextFunction } from "express";
import { SellersRepository } from "../../modules/sellers/sellers.repository";
import { ForbiddenError, UnauthorizedError } from "../errors/errors";

export const requireApprovedSeller = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  // Admins bypass seller status gate
  if (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN") {
    next();
    return;
  }

  const seller = await SellersRepository.findByUserId(req.user.id);
  if (!seller) {
    next(new ForbiddenError("Seller profile not found. Please complete merchant onboarding."));
    return;
  }

  if (seller.status !== "approved") {
    next(
      new ForbiddenError(
        `Seller account status is '${seller.status}'. Store and product management requires an approved merchant account.`
      )
    );
    return;
  }

  next();
};
