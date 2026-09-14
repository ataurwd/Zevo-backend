import { Request, Response } from "express";
import { UsersService } from "./users.service";
import { sendSuccess } from "../../shared/utils/response";
import { UnauthorizedError, BadRequestError } from "../../shared/errors/errors";

export class UsersController {
  public static getProfile = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const profile = await UsersService.getProfile(req.user.id);
    sendSuccess(res, profile);
  };

  public static updateProfile = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const updated = await UsersService.updateProfile(req.user.id, req.body);
    sendSuccess(res, updated, 200, "Profile updated successfully");
  };

  public static uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    if (!req.file) {
      throw new BadRequestError("Avatar image file is required");
    }

    // In local dev, store relative URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await UsersService.updateAvatar(req.user.id, avatarUrl);
    sendSuccess(res, updated, 200, "Avatar uploaded successfully");
  };

  public static changePassword = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await UsersService.changePassword(req.user.id, req.body);
    sendSuccess(res, { success: true }, 200, "Password updated successfully");
  };

  // Addresses
  public static getAddresses = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const addresses = await UsersService.getAddresses(req.user.id);
    sendSuccess(res, addresses);
  };

  public static getAddressById = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const address = await UsersService.getAddressById(req.user.id, req.params.id);
    sendSuccess(res, address);
  };

  public static createAddress = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const address = await UsersService.createAddress(req.user.id, req.body);
    sendSuccess(res, address, 201, "Address created successfully");
  };

  public static updateAddress = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const address = await UsersService.updateAddress(req.user.id, req.params.id, req.body);
    sendSuccess(res, address, 200, "Address updated successfully");
  };

  public static setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const address = await UsersService.setDefaultAddress(req.user.id, req.params.id);
    sendSuccess(res, address, 200, "Default address set successfully");
  };

  public static deleteAddress = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await UsersService.deleteAddress(req.user.id, req.params.id);
    sendSuccess(res, { deleted: true }, 200, "Address deleted successfully");
  };

  public static adminListUsers = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await UsersService.adminListUsers({ role, search, page, limit });
    sendSuccess(res, result);
  };

  public static adminCreateUser = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const user = await UsersService.adminCreateUser(req.body);
    sendSuccess(res, user, 201, "User created successfully");
  };

  public static adminUpdateUser = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const user = await UsersService.adminUpdateUser(req.params.id, req.body);
    sendSuccess(res, user, 200, "User updated successfully");
  };

}
