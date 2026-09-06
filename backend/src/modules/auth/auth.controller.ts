import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { AppError } from '../../middleware/errorHandler.js';

function getAuthCookieOptions(maxAge?: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.signup(req.body);
      if (result.session?.access_token) {
        res.cookie('personal_ca_session', result.session.access_token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
        if (result.session.refresh_token) {
          res.cookie('personal_ca_refresh_token', result.session.refresh_token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
        }
      }
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      // Set HttpOnly, SameSite=Lax, Secure cookies for access and refresh tokens
      if (result.session?.access_token) {
        res.cookie('personal_ca_session', result.session.access_token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
        if (result.session.refresh_token) {
          res.cookie('personal_ca_refresh_token', result.session.refresh_token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
        }
      }

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('personal_ca_session', getAuthCookieOptions());
      res.clearCookie('personal_ca_refresh_token', getAuthCookieOptions());
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
      let refreshToken = req.body?.refresh_token;
      if (!refreshToken && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc: Record<string, string>, pair: string) => {
          const [k, v] = pair.trim().split('=');
          if (k && v) acc[k] = decodeURIComponent(v);
          return acc;
        }, {} as Record<string, string>);
        refreshToken = cookies['personal_ca_refresh_token'];
      }

      if (!refreshToken) {
        return next(new AppError('Refresh token required in request body or cookie', 400, 'AUTH_MISSING_REFRESH_TOKEN'));
      }
      const result = await authService.refreshToken(refreshToken);

      if (result.session?.access_token) {
        res.cookie('personal_ca_session', result.session.access_token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
        if (result.session.refresh_token) {
          res.cookie('personal_ca_refresh_token', result.session.refresh_token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
        }
      }

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
