import { Router } from 'express';
import { TourController } from '@/controllers/common/tour.controller';
import { validate } from '@/middlewares/validation.middleware';
import { getTourQuerySchema, idParamSchema } from '@/validators/tour.validator';

const router = Router();

router.get(
    '/', 
    validate(getTourQuerySchema, 'query'), 
    TourController.getAllTours
);

router.get(
    '/:id', 
    validate(idParamSchema, 'params'), 
    TourController.getTourById
);

export default router;
