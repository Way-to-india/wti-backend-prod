import type { NextFunction, Request, Response } from 'express';

export default function ResponseHandler(req: Request, res: Response, next: NextFunction) {
  const requestStartTime = Date.now();

  res.deliver = (code: number, status: boolean, payload?: any, message?: string) => {
    res.statusMessage = message ?? '';
    res
      .status(code)
      .json({
        status,
        message: message ?? undefined,
        payload,
      })
      .end();
  };
  next();
}
