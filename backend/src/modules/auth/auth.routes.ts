import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { signupSchema, loginSchema, magicLinkSchema, updateProfileSchema } from './auth.schema.js';

const router = Router();

// Public auth endpoints
router.post('/signup', validateBody(signupSchema), authController.signup.bind(authController));
router.post('/login', validateBody(loginSchema), authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.post('/magic-link', validateBody(magicLinkSchema), authController.magicLink.bind(authController));

// Protected auth profile and session management endpoints
router.get('/me', requireAuth, authController.me.bind(authController));
router.put('/me', validateBody(updateProfileSchema), requireAuth, authController.updateMe.bind(authController));
router.post('/logout', authController.logout.bind(authController));

export const authRoutes = router;
