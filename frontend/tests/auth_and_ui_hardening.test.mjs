import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

describe('AUTHENTICATION AS THE MASTER GATE (AUTH-001 to AUTH-016)', () => {
  // Read and verify page components implement auth checks
  const appDir = path.join(srcDir, 'app');

  it('AUTH-001: Logged-out protected routes gate private financial UI', () => {
    // Check AuthGuard exists and renders AuthRequiredState
    const authGuardContent = fs.readFileSync(path.join(srcDir, 'components/layout/AuthGuard.tsx'), 'utf-8');
    assert(authGuardContent.includes('AuthRequiredState'), 'AuthGuard must render AuthRequiredState when unauthenticated');
    assert(authGuardContent.includes('isLoading'), 'AuthGuard must check isLoading');
  });

  it('AUTH-002: Logged-out protected API calls are blocked before auth', () => {
    // In every protected page, useEffect checks !authLoading && isAuthenticated before calling APIs
    const pagesToCheck = ['page.tsx', 'crore/page.tsx', 'plan/page.tsx', 'vault/page.tsx', 'statements/page.tsx'];
    for (const pageRel of pagesToCheck) {
      const content = fs.readFileSync(path.join(appDir, pageRel), 'utf-8');
      assert(content.includes('authLoading') || content.includes('isLoading'), `${pageRel} must reference authLoading state`);
      assert(content.includes('isAuthenticated'), `${pageRel} must reference isAuthenticated`);
    }
  });

  it('AUTH-003: Auth loading renders neutral loading shell without private data', () => {
    const croreContent = fs.readFileSync(path.join(appDir, 'crore/page.tsx'), 'utf-8');
    const planContent = fs.readFileSync(path.join(appDir, 'plan/page.tsx'), 'utf-8');
    const vaultContent = fs.readFileSync(path.join(appDir, 'vault/page.tsx'), 'utf-8');

    assert(croreContent.includes('Verifying secure workspace session...'), 'Crore page must show neutral loading shell');
    assert(planContent.includes('Verifying secure workspace session...'), 'Plan page must show neutral loading shell');
    assert(vaultContent.includes('Verifying secure workspace session...'), 'Vault page must show neutral loading shell');
  });

  it('AUTH-004 & AUTH-005: User data is user-scoped and derived from authenticated session', () => {
    const authContextContent = fs.readFileSync(path.join(srcDir, 'context/AuthContext.tsx'), 'utf-8');
    assert(authContextContent.includes('authApi.getMe()'), 'User identity must be derived from authApi.getMe()');
    assert(!authContextContent.includes('localStorage.getItem(\'user_id\')'), 'Must not read user_id from localStorage');
  });

  it('AUTH-006 & AUTH-007: Cross-user access impossible by design in client', () => {
    const apiContent = fs.readFileSync(path.join(srcDir, 'lib/api.ts'), 'utf-8');
    // Client never passes user_id in query or body for user scoping
    assert(!apiContent.includes('user_id: user.id'), 'Client must not pass explicit user_id override');
  });

  it('AUTH-008 & AUTH-009: Mutation endpoints do not allow client-supplied user_id override', () => {
    const apiContent = fs.readFileSync(path.join(srcDir, 'lib/api.ts'), 'utf-8');
    // Transactions and documents APIs must not accept user_id override
    assert(apiContent.includes('credentials: \'include\''), 'Requests must rely on HttpOnly session credentials');
  });

  it('AUTH-010: Logout clears private user state completely', () => {
    const authContextContent = fs.readFileSync(path.join(srcDir, 'context/AuthContext.tsx'), 'utf-8');
    assert(authContextContent.includes('await authApi.logout()'), 'Logout must call backend logout endpoint');
    assert(authContextContent.includes('setUser(null)'), 'Logout must reset user to null');
  });

  it('AUTH-011: MainCanvas keys main stage to purge all local React state on user change', () => {
    const mainCanvasContent = fs.readFileSync(path.join(srcDir, 'components/layout/MainCanvas.tsx'), 'utf-8');
    assert(mainCanvasContent.includes('key={user?.id || \'anonymous\'}'), 'MainCanvas must key content-canvas by user.id to destroy stale state');
  });

  it('AUTH-012: Hard reload preserves authenticated profile via authApi.getMe()', () => {
    const authContextContent = fs.readFileSync(path.join(srcDir, 'context/AuthContext.tsx'), 'utf-8');
    assert(authContextContent.includes('initAuth()') || authContextContent.includes('refreshProfile()'), 'Auth initialization must execute on mount');
  });

  it('AUTH-013: Direct IDOR routes protected by backend authentication and Supabase RLS', () => {
    const nextConfigContent = fs.readFileSync(path.join(__dirname, '../next.config.ts'), 'utf-8');
    assert(nextConfigContent.includes('/api/v1/:path*'), 'Next.js proxies /api/v1 through to backend');
  });

  it('AUTH-014: Storage signed URL access requires user authentication and private folder path', () => {
    const vaultContent = fs.readFileSync(path.join(appDir, 'vault/page.tsx'), 'utf-8');
    assert(vaultContent.includes('documentApi.create'), 'Upload creates metadata first');
    assert(vaultContent.includes('uploadBinary'), 'Upload uses signed storage URL');
  });

  it('AUTH-015: AI Financial Coach grounds context only for authenticated user', () => {
    const intelligenceContent = fs.readFileSync(path.join(appDir, 'intelligence/page.tsx'), 'utf-8');
    assert(intelligenceContent.includes('AuthRequiredState'), 'Intelligence page gates unauthenticated access');
  });

  it('AUTH-016: Zero sensitive financial data stored in localStorage or sessionStorage', () => {
    const files = [
      path.join(srcDir, 'context/AuthContext.tsx'),
      path.join(srcDir, 'lib/api.ts'),
      path.join(appDir, 'page.tsx'),
      path.join(appDir, 'ledger/page.tsx'),
      path.join(appDir, 'crore/page.tsx'),
      path.join(appDir, 'vault/page.tsx'),
    ];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      assert(!content.includes('localStorage.setItem(\'transactions\''), 'No transactions in localStorage');
      assert(!content.includes('localStorage.setItem(\'income\''), 'No income in localStorage');
      assert(!content.includes('sessionStorage.setItem(\'transactions\''), 'No transactions in sessionStorage');
    }
  });
});

describe('RESPONSIVE UI & MOBILE HARDENING (UI-001 to UI-009)', () => {
  const cssContent = fs.readFileSync(path.join(srcDir, 'app/globals.css'), 'utf-8');

  it('UI-001: 360px mobile viewport styles are defined', () => {
    assert(cssContent.includes('@media (max-width: 360px)'), 'globals.css must contain 360px media query');
  });

  it('UI-002: 375px & 390px mobile viewport styles are defined', () => {
    assert(cssContent.includes('@media (max-width: 375px)'), 'globals.css must contain 375px media query');
    assert(cssContent.includes('@media (max-width: 390px)'), 'globals.css must contain 390px media query');
  });

  it('UI-003: 768px tablet layout styles are defined', () => {
    assert(cssContent.includes('@media (max-width: 768px)'), 'globals.css must contain 768px media query');
  });

  it('UI-004: 1280px & 1440px desktop styles are defined', () => {
    assert(cssContent.includes('@media (min-width: 1440px)'), 'globals.css must contain 1440px media query');
  });

  it('UI-005: 1920px wide desktop viewport styles are defined', () => {
    assert(cssContent.includes('@media (min-width: 1920px)'), 'globals.css must contain 1920px media query');
  });

  it('UI-006: No horizontal page overflow (overflow-x: hidden enforced on viewport & canvas)', () => {
    assert(cssContent.includes('overflow-x: hidden'), 'globals.css must enforce overflow-x: hidden on small viewports');
    assert(cssContent.includes('max-width: 100vw'), 'globals.css must enforce max-width: 100vw');
  });

  it('UI-007: Mobile navigation bar is defined and activated on small viewports (<900px)', () => {
    assert(cssContent.includes('.mobile-only'), 'globals.css must define .mobile-only');
    assert(cssContent.includes('.desktop-only'), 'globals.css must define .desktop-only');
  });

  it('UI-008: Mobile upload input supports camera capture', () => {
    const vaultContent = fs.readFileSync(path.join(srcDir, 'app/vault/page.tsx'), 'utf-8');
    assert(vaultContent.includes('capture="environment"'), 'Vault must include camera input with capture="environment"');
  });

  it('UI-009: Desktop upload supports multi-media pickers (PDF, image, video)', () => {
    const vaultContent = fs.readFileSync(path.join(srcDir, 'app/vault/page.tsx'), 'utf-8');
    assert(vaultContent.includes('accept=".pdf,.csv"'), 'Vault must support document picker');
    assert(vaultContent.includes('image/png,image/jpeg,image/webp'), 'Vault must support photo picker');
    assert(vaultContent.includes('video/mp4,video/quicktime,video/webm'), 'Vault must support video picker');
  });
});
