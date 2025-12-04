import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';

export const validate = (schema: ZodTypeAny, source: 'body' | 'query' | 'params') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let dataToValidate = req[source];

      if (source === 'body' && req.body.data && typeof req.body.data === 'string') {
        try {
          dataToValidate = JSON.parse(req.body.data);
        } catch (parseError) {
          return res.status(400).json({
            status: false,
            message: 'Invalid JSON in data field',
            errors: [{ message: 'Failed to parse JSON data' }],
          });
        }
      }

      const validated = schema.parse(dataToValidate);

      req.validated = {
        ...req.validated,
        [source]: validated,
      };

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: false,
          message: 'Validation failed',
          errors: error.issues,
        });
      }
      next(error);
    }
  };
};

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: any;
        query?: any;
        params?: any;
      };
    }
  }
}
