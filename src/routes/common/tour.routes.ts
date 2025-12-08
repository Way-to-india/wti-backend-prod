import { Router } from 'express';
import { TourController } from '@/controllers/common/tour.controller';
import { validate } from '@/middlewares/validation.middleware';
import { getTourQuerySchema, idParamSchema } from '@/validators/tour.validator';
import { cache } from '@/middlewares/cache.middleware';

const router = Router();

const LIST_CACHE_TTL = 300;
const DETAIL_CACHE_TTL = 600;

router.get(
  '/',
  validate(getTourQuerySchema, 'query'),
  cache({
    ttl: LIST_CACHE_TTL,
    keyPrefix: 'tour:list',
  }),
  TourController.getAllTours
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  cache({
    ttl: DETAIL_CACHE_TTL,
    keyPrefix: 'tour:detail'
  }),
  TourController.getTourById
);

export default router;
