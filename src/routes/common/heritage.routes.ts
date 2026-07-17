import { Router } from 'express';
import { HeritageController } from '@/controllers/common/heritage.controller';
import { cache } from '@/middlewares/cache.middleware';

const router = Router();
const TTL = 1800;

router.get('/collections', cache({ ttl: TTL, keyPrefix: 'heritage:collections', excludeQuery: ['_t'] }), HeritageController.getCollections);
router.get('/collections/:slug', cache({ ttl: TTL, keyPrefix: 'heritage:collection', excludeQuery: ['_t'] }), HeritageController.getCollection);
router.get('/collections/:slug/sites/:site/tours', cache({ ttl: TTL, keyPrefix: 'heritage:site-tours', excludeQuery: ['_t'] }), HeritageController.getSiteTours);

export default router;
