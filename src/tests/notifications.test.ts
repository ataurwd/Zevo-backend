import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { notificationRepository } from "../modules/notifications/notification.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Notifications API & Domain", () => {
  const userId = "65f1a2b3c4d5e6f7a8b9c101";
  const notificationId = new ObjectId("65f1a2b3c4d5e6f7a8b9c102");
  let userToken: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    userToken = generateAccessToken({
      id: userId,
      email: "notifyuser@nexora.com",
      role: "CUSTOMER",
    }).token;
  });

  it("should fetch user notifications and unread count", async () => {
    vi.spyOn(notificationRepository, "findByUser").mockResolvedValue({
      notifications: [
        {
          _id: notificationId,
          user_id: userId,
          type: "order_created",
          title: "Order Placed",
          body: "Your order has been placed.",
          is_read: false,
          created_at: new Date(),
        },
      ],
      total: 1,
    });
    vi.spyOn(notificationRepository, "getUnreadCount").mockResolvedValue(1);

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.unreadCount).toBe(1);
  });

  it("should return unread count independently", async () => {
    vi.spyOn(notificationRepository, "getUnreadCount").mockResolvedValue(4);

    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBe(4);
  });

  it("should mark a single notification as read", async () => {
    vi.spyOn(notificationRepository, "markAsRead").mockResolvedValue(true);

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId.toString()}/read`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should mark all notifications as read", async () => {
    vi.spyOn(notificationRepository, "markAllAsRead").mockResolvedValue(3);

    const res = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.markedCount).toBe(3);
  });
});
