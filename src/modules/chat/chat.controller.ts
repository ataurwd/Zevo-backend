import { Request, Response, NextFunction } from "express";
import { chatService, ChatService } from "./chat.service";

export class ChatController {
  startSupportConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const userName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.email;
      const userRole = user.role || "customer";

      const conversation = await this.service.startOrGetSupportConversation(
        userId,
        userRole,
        userName,
        req.body?.initial_message
      );

      return res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  };

  constructor(private service: ChatService = chatService) {}

  startConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const userName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.email;
      const userRole = user.role || "customer";

      const conversation = await this.service.startOrGetConversation(
        userId,
        userRole,
        userName,
        req.body
      );

      return res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  };

  getConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const userRole = (req as any).user.role || "customer";
      const conversations = await this.service.getUserConversations(userId, userRole, limit, skip);

      return res.status(200).json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const userRole = user.role || "customer";
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await this.service.getMessages(id, userId, userRole, limit, skip);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const userName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.email;
      const userRole = user.role || "customer";
      const { id } = req.params;

      const message = await this.service.sendMessage(
        id,
        userId,
        userName,
        userRole.toLowerCase() as any,
        req.body
      );

      return res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { id } = req.params;

      const count = await this.service.markAsRead(id, userId);

      return res.status(200).json({
        success: true,
        data: { markedCount: count },
      });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const unreadCount = await this.service.getUnreadCount(userId);

      return res.status(200).json({
        success: true,
        data: { unreadCount },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const chatController = new ChatController();
