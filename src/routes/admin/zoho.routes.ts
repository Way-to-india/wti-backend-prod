import { zohoCallBack } from '@/controllers/admin/zoho.controller';
import { Router } from 'express';

const router = Router();

router.get("/callback",zohoCallBack);

export default router;
