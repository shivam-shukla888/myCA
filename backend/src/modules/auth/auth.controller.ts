import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.signup(req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      // Set HttpOnly, SameSite=Strict cookie for enhanced XSS defense
      if (result.session?.access_token) {
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('personal_ca_session', result.session.access_token, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
      }

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('personal_ca_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      res.status(200).json({ data: { message: 'Session terminated successfully' } });
    } catch (err) {
      next(err);
    }
  }

  async magicLink(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.sendMagicLink(req.body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body?.refresh_token;
      if (!refreshToken) {
        return next(new AppError('Refresh token required in request body', 400, 'AUTH_MISSING_REFRESH_TOKEN'));
      }
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const profile = await authService.getProfile(userId);
      res.status(200).json({ data: { ...profile, email: req.user?.email || (profile as any).email } });
    } catch (err) {
      next(err);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const updated = await authService.updateProfile(userId, req.body);
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
