import { Router } from 'express';
import { SacredController } from '@/controllers/common/sacred.controller';
import { cache } from '@/middlewares/cache.middleware';

const router = Router();
const TTL = 1800;

router.get('/circuits', cache({ ttl: TTL, keyPrefix: 'sacred:circuits', excludeQuery: ['_t'] }), SacredController.getCircuits);
router.get('/tours', cache({ ttl: TTL, keyPrefix: 'sacred:tours', excludeQuery: ['_t'] }), SacredController.getTours);

export default router;
