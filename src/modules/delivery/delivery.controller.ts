import { Request, Response, NextFunction } from "express";
import { deliveryService, DeliveryService } from "./delivery.service";

export class DeliveryController {
  constructor(private service: DeliveryService = deliveryService) {}

  getRiderProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const profile = await this.service.getRiderProfile(userId);

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  toggleOnlineStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { is_online } = req.body;

      const profile = await this.service.toggleOnlineStatus(userId, Boolean(is_online));

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const tasks = await this.service.getRiderTasks(userId);

      return res.status(200).json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  };

  updateLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { taskId, latitude, longitude } = req.body;

      const result = await this.service.updateLocation(userId, {
        taskId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  startPickup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { taskId } = req.params;

      const task = await this.service.startPickup(taskId, userId);

      return res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  confirmPickup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { taskId } = req.params;

      const task = await this.service.confirmPickup(taskId, userId);

      return res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  startDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { taskId } = req.params;

      const task = await this.service.startDelivery(taskId, userId);

      return res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  completeDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { taskId } = req.params;

      const task = await this.service.completeDelivery(taskId, userId);

      return res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  failDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { taskId } = req.params;
      const { reason } = req.body;

      const task = await this.service.failDelivery(taskId, userId, reason || "Delivery failed");

      return res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  getTracking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const tracking = await this.service.getTrackingDetails(taskId);

      return res.status(200).json({
        success: true,
        data: tracking,
      });
    } catch (error) {
      next(error);
    }
  };

  adminListRiders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;
      const status = req.query.status as any;

      const result = await this.service.adminListRiders(skip, limit, status);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  adminUpdateRiderStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const success = await this.service.adminUpdateRiderStatus(id, status);

      return res.status(200).json({
        success,
        message: success ? "Rider status updated" : "Rider not found",
      });
    } catch (error) {
      next(error);
    }
  };

  adminListTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;
      const status = req.query.status as any;

      const result = await this.service.adminListTasks(skip, limit, status);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getAvailableRiders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { city, zone } = req.query;
      const riders = await this.service.getAvailableRiders(city as string, zone as string);

      return res.status(200).json({
        success: true,
        data: {
          riders,
          total: riders.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  assignRider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const sub_order_id = req.body.sub_order_id || req.body.subOrderId;
      const rider_id = req.body.rider_id || req.body.riderId;
      const order_id = req.body.order_id || req.body.orderId;

      if (!sub_order_id || !rider_id) {
        return res.status(400).json({
          success: false,
          message: "sub_order_id and rider_id are required",
        });
      }

      const result = await this.service.assignRiderToSubOrder(user, {
        subOrderId: sub_order_id,
        riderId: rider_id,
        orderId: order_id,
      });

      return res.status(200).json({
        success: true,
        message: "Rider successfully assigned to order",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateRiderProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const profile = await this.service.updateRiderProfile(userId, req.body);

      return res.status(200).json({
        success: true,
        message: "Rider profile updated successfully",
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };


  requestCashout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { amount, method, account_details } = req.body;
      const result = await this.service.requestCashout(
        userId,
        Math.round(Number(amount) || 0),
        method,
        account_details
      );
      return res.status(201).json({
        success: true,
        message: "Cashout request submitted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyPayouts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const payouts = await this.service.getPayouts(userId);
      return res.status(200).json({
        success: true,
        data: payouts,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const deliveryController = new DeliveryController();
