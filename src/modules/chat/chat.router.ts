import { Router } from "express";
import { chatController } from "./chat.controller";
import { authenticate } from "../../shared/middleware/authenticate";

const router = Router();

// All chat endpoints require authenticated session
router.use(authenticate);

router.post("/support", chatController.startSupportConversation);
router.post("/conversations", chatController.startConversation);
router.get("/conversations", chatController.getConversations);
router.get("/conversations/:id/messages", chatController.getMessages);
router.post("/conversations/:id/messages", chatController.sendMessage);
router.patch("/conversations/:id/read", chatController.markAsRead);
router.get("/unread-count", chatController.getUnreadCount);

export const chatRouter = router;
