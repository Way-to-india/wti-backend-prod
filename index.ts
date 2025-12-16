import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routerSetup from '@/routes';
import rateLimit from 'express-rate-limit';
import ResponseHandler from '@/middlewares/handlers/responseHandler';
import { InternalServerError } from '@/middlewares/handlers/errorHandler';

const errorHandler = require('@/middlewares/error');

class Server {
  private app: Application;
  private port: string | number;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    this.configureMiddleware(this.app);
    this.configureRoutes(this.app);
    this.errorMiddleware(this.app);
  }

  private configureMiddleware(app: Application): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));
    console.log('Configuring Rate Limiting...');
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      // skip: (req: Request) => {
      //   console.log(req.path);
      //   return req.path === '/api/user/auth/login'
      // }
    });
    app.use(globalLimiter);
    console.log('Configuring CORS middleware...');
    app.use(
      cors({
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      })
    );
    app.use(express.json({ limit: '50mb' }));
    app.use(
      express.urlencoded({
        limit: '50mb',
        extended: true,
        parameterLimit: 50000,
      })
    );
    app.set('trust proxy', 1);
  }

  private configureRoutes(app: Application): void {
    app.use(ResponseHandler);

    app.use((_req: Request, _res: Response, next: NextFunction) => {
      if (process.env.MAINTENANCE_MODE === 'true') {
        throw new InternalServerError('Server down, please try again after few minutes.');
      }
      next();
    });
    routerSetup(app);
  }

  private errorMiddleware(app: Application): void {
    app.use(errorHandler);
  }

  public start(): void {
    this.app.listen(this.port, () => console.log(`Server running on port ${this.port}`));
  }

  public getApp(): Application {
    return this.app;
  }
}

const server = new Server();

if (require.main === module) {
  server.start();
}

export const app = server.getApp();
