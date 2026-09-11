import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodTypeAny } from "zod";

export interface RequestValidationSchema {
  body?: AnyZodObject | ZodTypeAny;
  query?: AnyZodObject | ZodTypeAny;
  params?: AnyZodObject | ZodTypeAny;
}

export const validate = (schema: RequestValidationSchema | AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if ("parseAsync" in schema) {
        const parsed = (await (schema as AnyZodObject).parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        })) as { body?: unknown; query?: unknown; params?: unknown };

        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query as typeof req.query;
        if (parsed.params !== undefined) req.params = parsed.params as typeof req.params;
      } else {
        if (schema.params) {
          req.params = (await schema.params.parseAsync(req.params)) as typeof req.params;
        }
        if (schema.query) {
          req.query = (await schema.query.parseAsync(req.query)) as typeof req.query;
        }
        if (schema.body) {
          req.body = await schema.body.parseAsync(req.body);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
