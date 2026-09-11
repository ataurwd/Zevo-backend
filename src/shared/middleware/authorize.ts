import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/errors";
import { UserRole } from "../types/express";

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required before authorization"));
      return;
    }

    // SUPER_ADMIN has platform-level access
    if (req.user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
      return;
    }

    next();
  };
};
