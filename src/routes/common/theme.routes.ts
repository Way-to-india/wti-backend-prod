import { ThemeController } from '@/controllers/common/theme.controller';
import { Router } from 'express';
// import { validate } from '@/middlewares/validation.middleware';

const router = Router();

router.get('/', ThemeController.getAllThemes);

router.get('/:id', ThemeController.getThemeById);

export default router;
