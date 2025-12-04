import type { NextFunction, Request, Response } from 'express';

export const zohoCallBack = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(req);
    res.send('Hello');
  } catch (error) {
    next(error);
  }
};
