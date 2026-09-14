export type UserRole = "CUSTOMER" | "SELLER" | "DELIVERY_AGENT" | "ADMIN" | "SUPER_ADMIN" | "SUPPORT";

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  storeId?: string;
  deliveryAgentId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      requestId?: string;
      startTime?: number;
      rawBody?: Buffer;
    }
  }
}
