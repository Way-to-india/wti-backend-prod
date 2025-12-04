import { CityController } from '@/controllers/common/city.controller';
import { Router } from 'express';
// import { validate } from '@/middlewares/validation.middleware';

const router = Router();

router.get('/', CityController.getAllCities);

router.get('/:id', CityController.getCityById);

export default router;
