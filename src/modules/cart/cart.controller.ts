import { Request, Response } from "express";
import crypto from "crypto";
import { CartService } from "./cart.service";
import { sendSuccess } from "../../shared/utils/response";
import { UnauthorizedError } from "../../shared/errors/errors";

function getGuestToken(req: Request, res?: Response): string | undefined {
  const fromHeader = req.headers["x-guest-cart-id"] as string;
  if (fromHeader) return fromHeader;

  const fromCookie = req.cookies?.nexora_cart_guest;
  if (fromCookie) return fromCookie;

  // Auto-generate a guest token if neither exists and this is an unauthenticated request
  if (!req.user && res) {
    const newToken = crypto.randomUUID();
    res.cookie("nexora_cart_guest", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return newToken;
  }

  return undefined;
}

export class CartController {
  public static getCart = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const cart = await CartService.getCart(userId, guestToken);
    sendSuccess(res, cart);
  };

  public static addItem = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const cart = await CartService.addItem(userId, guestToken, req.body);
    sendSuccess(res, cart, 200, "Item added to cart");
  };

  public static updateQuantity = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const cart = await CartService.updateQuantity(
      userId,
      guestToken,
      req.params.variantId,
      req.body.quantity
    );
    sendSuccess(res, cart, 200, "Cart quantity updated");
  };

  public static removeItem = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const cart = await CartService.removeItem(
      userId,
      guestToken,
      req.params.variantId
    );
    sendSuccess(res, cart, 200, "Item removed from cart");
  };

  public static clearCart = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    await CartService.clearCart(userId, guestToken);
    sendSuccess(res, { cleared: true }, 200, "Cart cleared");
  };

  public static mergeCart = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Authentication required to merge cart");

    const guestToken = req.body.guest_session_token || getGuestToken(req);
    if (!guestToken) {
      const currentCart = await CartService.getCart(req.user.id);
      sendSuccess(res, currentCart, 200, "No guest cart to merge");
      return;
    }

    const merged = await CartService.mergeCart(req.user.id, guestToken);

    // Clear guest cookie if set
    res.clearCookie("nexora_cart_guest");
    sendSuccess(res, merged, 200, "Guest cart merged into account");
  };

  public static validateCart = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const result = await CartService.validateCart(userId, guestToken);
    sendSuccess(res, result);
  };

  public static applyCoupon = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const cart = await CartService.applyCoupon(userId, guestToken, req.body.code);
    sendSuccess(res, cart, 200, `Coupon "${req.body.code.toUpperCase()}" applied!`);
  };

  public static removeCoupon = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user?.id;
    const guestToken = getGuestToken(req, res);

    const cart = await CartService.removeCoupon(userId, guestToken);
    sendSuccess(res, cart, 200, "Coupon removed");
  };
}
