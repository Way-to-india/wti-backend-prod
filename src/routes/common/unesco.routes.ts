import { Router } from 'express';
import { UnescoController } from '@/controllers/common/unesco.controller';
import { cache } from '@/middlewares/cache.middleware';

const router = Router();

const TTL = 1800; // UNESCO data changes only when the seed/map scripts re-run; cache 30 min.

router.get('/sites', cache({ ttl: TTL, keyPrefix: 'unesco:sites', excludeQuery: ['_t'] }), UnescoController.getSites);
router.get('/tours', cache({ ttl: TTL, keyPrefix: 'unesco:tours', excludeQuery: ['_t'] }), UnescoController.getTours);
router.get('/sites/:idOrSlug/tours', cache({ ttl: TTL, keyPrefix: 'unesco:site-tours', excludeQuery: ['_t'] }), UnescoController.getSiteTours);

export default router;
