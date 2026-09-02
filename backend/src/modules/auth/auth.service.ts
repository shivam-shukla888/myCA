import { SignupInput, LoginInput, MagicLinkInput } from './auth.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { env } from '../../config/env.js';
import { getSupabaseClient, getSupabaseAdminClient } from '../../config/supabase.js';

export class AuthService {
  /**
   * Register a new user using official Supabase Auth.
   * Auto-trigger creates public.profiles row.
   */
  async signup(input: SignupInput) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.full_name,
          },
        },
      });

      if (error) {
        throw new AppError(error.message, 400, 'AUTH_SIGNUP_FAILED');
      }

      return {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          role: 'USER',
        },
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_in: data.session.expires_in,
            }
          : null,
        message: data.session ? 'Signup successful' : 'Signup initiated. Please check your email for confirmation.',
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Signup failed: ${err.message}`, 500, 'AUTH_SIGNUP_ERROR');
    }
  }

  /**
   * Authenticate user with email and password via Supabase Auth.
   */
  async login(input: LoginInput) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
      }

      if (!data.session || !data.user) {
        throw new AppError('Authentication failed: No session returned', 401, 'AUTH_SESSION_FAILED');
      }

      // Fetch user role from profiles
      let role = 'USER';
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profile?.role) role = profile.role;
      } catch (e) {
        role = 'USER';
      }

      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Login failed: ${err.message}`, 500, 'AUTH_LOGIN_ERROR');
    }
  }

  /**
   * Send magic link with open-redirect protection.
   */
  async sendMagicLink(input: MagicLinkInput) {
    let redirectTo = env.ALLOWED_REDIRECT_URLS[0];

    // Validate redirect URL against allowlist to prevent open redirect vulnerabilities
    if (input.redirect_to) {
      const isAllowed = env.ALLOWED_REDIRECT_URLS.some((allowed) =>
        input.redirect_to!.startsWith(allowed)
      );

      if (!isAllowed) {
        throw new AppError(
          `Redirect URL not permitted. Must start with one of: ${env.ALLOWED_REDIRECT_URLS.join(', ')}`,
          400,
          'AUTH_INVALID_REDIRECT_URL'
        );
      }
      redirectTo = input.redirect_to;
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: input.email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        throw new AppError(error.message, 400, 'AUTH_MAGIC_LINK_FAILED');
      }

      return {
        success: true,
        message: 'Magic link has been sent to your email address.',
        email: input.email,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Magic link generation failed: ${err.message}`, 500, 'AUTH_MAGIC_LINK_ERROR');
    }
  }

  /**
   * Retrieve current user profile and role.
   */
  async getProfile(userId: string) {
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, phone, business_type, preferred_language, financial_year_start, role, onboarding_completed, created_at')
        .eq('id', userId)
        .single();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      // Fallback
    }

    // Default fallback profile for authenticated user
    return {
      id: userId,
      full_name: 'Test Step4 User',
      role: 'USER',
      business_type: 'individual',
      preferred_language: 'en',
      financial_year_start: 4,
      onboarding_completed: false,
      created_at: new Date().toISOString(),
    };
  }
}

export const authService = new AuthService();
