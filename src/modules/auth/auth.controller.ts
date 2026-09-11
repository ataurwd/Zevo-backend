import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { sendSuccess } from "../../shared/utils/response";
import { UnauthorizedError } from "../../shared/errors/errors";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
  });
};

export class AuthController {
  public static register = async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.register(req.body, req.ip);
    sendSuccess(
      res,
      result.user,
      201,
      "Registration successful! Please check your email to verify your account."
    );
  };

  public static verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;
    const result = await AuthService.verifyEmail(token);
    setRefreshCookie(res, result.tokens.refreshToken);
    sendSuccess(
      res,
      {
        user: result.user,
        access_token: result.tokens.accessToken,
      },
      200,
      "Email successfully verified!"
    );
  };

  public static login = async (req: Request, res: Response): Promise<void> => {
    const userAgent = req.headers["user-agent"];
    const result = await AuthService.login(req.body, req.ip, userAgent);
    setRefreshCookie(res, result.tokens.refreshToken);
    sendSuccess(
      res,
      {
        user: result.user,
        access_token: result.tokens.accessToken,
      },
      200,
      "Login successful"
    );
  };

  public static refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token missing");
    }

    const result = await AuthService.refresh(refreshToken);
    setRefreshCookie(res, result.tokens.refreshToken);
    sendSuccess(
      res,
      {
        user: result.user,
        access_token: result.tokens.accessToken,
      },
      200,
      "Token refreshed successfully"
    );
  };

  public static logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
    const userId = req.user?.id;
    await AuthService.logout(refreshToken, userId, req.ip);
    clearRefreshCookie(res);
    sendSuccess(res, { logged_out: true }, 200, "Logged out successfully");
  };

  public static forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    await AuthService.forgotPassword(email, req.ip);
    sendSuccess(
      res,
      { sent: true },
      200,
      "If the email is associated with an account, a password reset link has been dispatched."
    );
  };

  public static resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, new_password } = req.body;
    await AuthService.resetPassword(token, new_password, req.ip);
    clearRefreshCookie(res);
    sendSuccess(
      res,
      { updated: true },
      200,
      "Password has been reset successfully. Please log in with your new credentials."
    );
  };

  public static me = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.user, 200);
  };
}
