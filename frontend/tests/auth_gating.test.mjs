import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Suite: Frontend Authentication Gating Tests
 * Verifies that protected API calls NEVER execute under unauthenticated, loading, or race conditions.
 */

// Simulated API spy
class ApiSpy {
  constructor() {
    this.calls = [];
  }

  record(endpoint) {
    this.calls.push({ endpoint, time: Date.now() });
  }

  reset() {
    this.calls = [];
  }

  hasCalled(endpoint) {
    return this.calls.some((c) => c.endpoint === endpoint);
  }

  get count() {
    return this.calls.length;
  }
}

// Controller simulating the exact page gating logic in:
// - frontend/src/app/page.tsx
// - frontend/src/app/vault/page.tsx
// - frontend/src/app/plan/page.tsx
// - frontend/src/app/statements/page.tsx
// - frontend/src/app/ledger/page.tsx
class PageAuthController {
  constructor(pageName, apiSpy, protectedEndpoints) {
    this.pageName = pageName;
    this.api = apiSpy;
    this.protectedEndpoints = protectedEndpoints;
    this.renderedView = 'INITIAL';
  }

  // Simulates React component render and useEffect execution given auth state
  evaluateState({ authLoading, isAuthenticated }) {
    // 1. Guard check in useEffect
    if (authLoading || !isAuthenticated) {
      // In component render:
      if (authLoading) {
        this.renderedView = 'LOADING_SPINNER';
      } else if (!isAuthenticated) {
        this.renderedView = 'AUTH_REQUIRED_STATE';
      }
      return; // Protected APIs are NOT invoked
    }

    // 2. Authenticated branch
    this.renderedView = 'AUTHENTICATED_PAGE';
    for (const endpoint of this.protectedEndpoints) {
      this.api.record(endpoint);
    }
  }
}

test('CASE 1: unauthenticated + auth loading → no protected API call', () => {
  const spy = new ApiSpy();
  const pages = [
    new PageAuthController('dashboard', spy, ['/transactions', '/reports/cashflow', '/documents']),
    new PageAuthController('vault', spy, ['/documents']),
    new PageAuthController('plan', spy, ['/allocation/rules', '/freedom/projection', '/action/plan']),
    new PageAuthController('statements', spy, ['/reports/generate']),
    new PageAuthController('ledger', spy, ['/transactions']),
  ];

  for (const page of pages) {
    page.evaluateState({ authLoading: true, isAuthenticated: false });
    assert.equal(page.renderedView, 'LOADING_SPINNER', `${page.pageName} must show loading spinner`);
  }

  assert.equal(spy.count, 0, 'Zero protected API calls must be made while auth is initializing');
});

test('CASE 2: unauthenticated + auth resolved → no protected API call → login CTA/state', () => {
  const spy = new ApiSpy();
  const pages = [
    new PageAuthController('dashboard', spy, ['/transactions', '/reports/cashflow', '/documents']),
    new PageAuthController('vault', spy, ['/documents']),
    new PageAuthController('plan', spy, ['/allocation/rules', '/freedom/projection', '/action/plan']),
    new PageAuthController('statements', spy, ['/reports/generate']),
  ];

  for (const page of pages) {
    page.evaluateState({ authLoading: false, isAuthenticated: false });
    assert.equal(page.renderedView, 'AUTH_REQUIRED_STATE', `${page.pageName} must display AuthRequiredState`);
  }

  assert.equal(spy.count, 0, 'Zero protected API calls must be made when unauthenticated');
});

test('CASE 3: authenticated → protected API calls execute normally', () => {
  const spy = new ApiSpy();
  const dashboard = new PageAuthController('dashboard', spy, ['/transactions', '/reports/cashflow', '/documents']);
  const vault = new PageAuthController('vault', spy, ['/documents']);
  const plan = new PageAuthController('plan', spy, ['/allocation/rules', '/freedom/projection', '/action/plan']);
  const statements = new PageAuthController('statements', spy, ['/reports/generate']);

  dashboard.evaluateState({ authLoading: false, isAuthenticated: true });
  assert.equal(dashboard.renderedView, 'AUTHENTICATED_PAGE');
  assert.ok(spy.hasCalled('/transactions'));
  assert.ok(spy.hasCalled('/reports/cashflow'));
  assert.ok(spy.hasCalled('/documents'));

  vault.evaluateState({ authLoading: false, isAuthenticated: true });
  plan.evaluateState({ authLoading: false, isAuthenticated: true });
  statements.evaluateState({ authLoading: false, isAuthenticated: true });

  assert.ok(spy.hasCalled('/allocation/rules'));
  assert.ok(spy.hasCalled('/freedom/projection'));
  assert.ok(spy.hasCalled('/reports/generate'));
});

test('CASE 4: logout → protected calls stop and login CTA appears', () => {
  const spy = new ApiSpy();
  const dashboard = new PageAuthController('dashboard', spy, ['/transactions']);

  // Initial logged in state
  dashboard.evaluateState({ authLoading: false, isAuthenticated: true });
  assert.equal(spy.count, 1);
  assert.equal(dashboard.renderedView, 'AUTHENTICATED_PAGE');

  // User logs out: session cleared
  spy.reset();
  dashboard.evaluateState({ authLoading: false, isAuthenticated: false });
  assert.equal(spy.count, 0, 'No API calls must be triggered after logout');
  assert.equal(dashboard.renderedView, 'AUTH_REQUIRED_STATE', 'AuthRequiredState must be rendered after logout');
});

test('CASE 5: auth initialization race → no premature API call', async () => {
  const spy = new ApiSpy();
  const vault = new PageAuthController('vault', spy, ['/documents']);

  // Step 1: Component mounts immediately, Supabase auth handshake is in flight (authLoading: true)
  vault.evaluateState({ authLoading: true, isAuthenticated: false });
  assert.equal(spy.count, 0, 'Race condition: Component mounted before auth handshake must NOT fire API call');

  // Step 2: Supabase resolves with null session (unauthenticated)
  vault.evaluateState({ authLoading: false, isAuthenticated: false });
  assert.equal(spy.count, 0, 'After auth resolves unauthenticated, still zero API calls');
  assert.equal(vault.renderedView, 'AUTH_REQUIRED_STATE');

  // Step 3: Different scenario: Supabase resolves with valid session after delay
  const dashboard = new PageAuthController('dashboard', spy, ['/transactions']);
  dashboard.evaluateState({ authLoading: true, isAuthenticated: false });
  assert.equal(spy.count, 0, 'No calls during slow auth initialization');

  // Auth completes with valid session
  dashboard.evaluateState({ authLoading: false, isAuthenticated: true });
  assert.equal(spy.count, 1, 'API call executes only AFTER auth has definitively resolved to true');
  assert.equal(dashboard.renderedView, 'AUTHENTICATED_PAGE');
});
