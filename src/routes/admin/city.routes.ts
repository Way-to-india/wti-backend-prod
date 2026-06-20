import { AdminCityController } from '@/controllers/admin/city.controller';
import { Router } from 'express';

const router = Router();

router.post('/', AdminCityController.createCity);
router.delete('/:id', AdminCityController.deleteCity);

export default router;
