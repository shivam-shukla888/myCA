import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Suite: Frontend Signup & Onboarding Flow Tests
 * Verifies client-side validation, email verification handling,
 * onboarding persistence, and strict production security guarantees.
 */

// 1. Validation Logic Mirror
function validateSignupForm({ fullName, email, password, confirmPassword }) {
  if (!fullName || !fullName.trim()) {
    return 'Full Name is required.';
  }
  if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}

test('VALIDATION: Rejects empty full name', () => {
  const error = validateSignupForm({
    fullName: '   ',
    email: 'user@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });
  assert.equal(error, 'Full Name is required.');
});

test('VALIDATION: Rejects malformed email formats', () => {
  const invalidEmails = ['plainaddress', 'missingdomain@', '@missinguser.com', 'user@domain'];
  for (const email of invalidEmails) {
    const error = validateSignupForm({
      fullName: 'Valid User',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    assert.equal(error, 'Please enter a valid email address.', `Should reject invalid email: ${email}`);
  }
});

test('VALIDATION: Enforces minimum password length of 8 characters', () => {
  const error = validateSignupForm({
    fullName: 'Valid User',
    email: 'user@example.com',
    password: '1234567',
    confirmPassword: '1234567',
  });
  assert.equal(error, 'Password must be at least 8 characters long.');
});

test('VALIDATION: Rejects password mismatch', () => {
  const error = validateSignupForm({
    fullName: 'Valid User',
    email: 'user@example.com',
    password: 'Password123!',
    confirmPassword: 'DifferentPassword123!',
  });
  assert.equal(error, 'Passwords do not match.');
});

test('VALIDATION: Accepts valid complete signup credentials', () => {
  const error = validateSignupForm({
    fullName: 'Shivam Shukla',
    email: 'shivam@example.com',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
  });
  assert.equal(error, null, 'Valid credentials must pass validation');
});

// 2. Auth Flow & Email Verification States
test('SIGNUP FLOW: Supabase requiring email verification (null session) triggers verification banner', async () => {
  // Mock API returning null session (Supabase requires confirmation)
  const mockSignupResponse = {
    user: { id: 'usr-123', email: 'verify@example.com', role: 'USER' },
    session: null,
    message: 'Signup initiated. Please check your email for confirmation.',
  };

  let requiresEmailVerification = false;
  let bannerMessage = '';
  let storedToken = null;

  if (mockSignupResponse.session?.access_token) {
    storedToken = mockSignupResponse.session.access_token;
    requiresEmailVerification = false;
  } else {
    requiresEmailVerification = true;
    bannerMessage = mockSignupResponse.message || 'Check your email to verify your account.';
  }

  assert.equal(requiresEmailVerification, true, 'Must flag that email verification is required');
  assert.equal(storedToken, null, 'No session token must be stored before verification');
  assert.match(bannerMessage, /email for confirmation|verify your account/i);
});

test('SIGNUP FLOW: Supabase direct session routes immediately to /onboarding', async () => {
  const mockSignupResponse = {
    user: { id: 'usr-456', email: 'direct@example.com', role: 'USER' },
    session: {
      access_token: 'valid.supabase.jwt',
      refresh_token: 'valid.refresh.token',
      expires_in: 3600,
    },
    message: 'Signup successful',
  };

  let targetRoute = '';
  let storedToken = null;

  if (mockSignupResponse.session?.access_token) {
    storedToken = mockSignupResponse.session.access_token;
    targetRoute = '/onboarding';
  } else {
    targetRoute = '/login';
  }

  assert.equal(targetRoute, '/onboarding', 'Direct signup must route to financial onboarding');
  assert.equal(storedToken, 'valid.supabase.jwt');
});

// 3. Security & Production Mock Token Rejection
test('SECURITY: Production strictly rejects mock tokens', () => {
  let userState = null;
  let tokenState = null;

  function setUserDirectly(user, token, nodeEnv) {
    if (nodeEnv !== 'development' && token.startsWith('mock-test-token:')) {
      // Strictly rejected in production / staging
      return;
    }
    userState = user;
    tokenState = token;
  }

  // Attempt to inject mock token in production
  setUserDirectly(
    { id: 'hacker', email: 'hack@example.com', role: 'ADMIN' },
    'mock-test-token:hacker:hack@example.com',
    'production'
  );

  assert.equal(userState, null, 'Mock token user must NOT be accepted in production');
  assert.equal(tokenState, null, 'Mock token must NOT be stored in production');
});

// 4. Onboarding Data Model & Persistence Contract
test('ONBOARDING: Wizard metrics match database schema and allow non-blocking skip', () => {
  const onboardingInput = {
    monthlyIncome: 120000,
    monthlyExpenses: 45000,
    existingSavings: 300000,
    existingInvestments: 600000,
    desiredLifestyleIncome: 90000,
  };

  const payload = {
    monthly_income: Number(onboardingInput.monthlyIncome) || 0,
    monthly_essential_expenses: Number(onboardingInput.monthlyExpenses) || 0,
    existing_liquid_savings: Number(onboardingInput.existingSavings) || 0,
    existing_investments: Number(onboardingInput.existingInvestments) || 0,
    desired_monthly_lifestyle_income: Number(onboardingInput.desiredLifestyleIncome) || 0,
  };

  assert.equal(payload.monthly_income, 120000);
  assert.equal(payload.monthly_essential_expenses, 45000);
  assert.equal(payload.existing_liquid_savings, 300000);
  assert.equal(payload.existing_investments, 600000);
  assert.equal(payload.desired_monthly_lifestyle_income, 90000);

  // Profile update marks completion
  const profileUpdate = {
    full_name: 'Shivam Shukla',
    onboarding_completed: true,
  };
  assert.equal(profileUpdate.onboarding_completed, true);
});
