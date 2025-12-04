import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }

    interface Response {
      /**
       * @params status -> HTTP response code
       * @params message -> optional param
       * @params payload -> final result of the specific api
       */
      deliver: (
        code: number,
        status: boolean,
        payload?: any,
        message?: string,
      ) => void;
    }
  }
}

export {};