import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import AuthRouter from './auth.routes';

const router = Router();

router.use(AppRoutes.AUTH, AuthRouter);


export default router;
