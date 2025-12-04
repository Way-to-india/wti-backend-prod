import { Router } from 'express';
import { QueryController } from '@/controllers/common/query.controller';

const router = Router();

router.post('/tour', QueryController.submitTourQuery);

router.post('/hotel', QueryController.submitHotelQuery);

router.post('/transport', QueryController.submitTransportQuery);

router.post('/contact-us', QueryController.submitContactUsQuery);

export default router;
