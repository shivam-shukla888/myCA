import './setup.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { testUserRoles } from '../src/middleware/auth.js';

describe('Production User Signup & Profile Lifecycle Test Suite', () => {
  let app: any;
  const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const otherUserId = 'a1111111-2222-3333-4444-555555555555';

  before(async () => {
    app = createApp();
    // Register test user with default USER role
    testUserRoles.set(testUserId, 'USER');
  });

  after(() => {
    testUserRoles.delete(testUserId);
  });

  describe('1. Signup Input Validation & Schema Hardening', () => {
    it('rejects signup with missing full_name', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'valid@example.com',
          password: 'Password123!',
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.error || res.body.message);
    });

    it('rejects signup with invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          full_name: 'Test User',
        });

      assert.equal(res.status, 400);
    });

    it('rejects signup with password under 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'user@example.com',
          password: '123',
          full_name: 'Test User',
        });

      assert.equal(res.status, 400);
      assert.match(JSON.stringify(res.body), /at least 8 characters/i);
    });
  });

  describe('2. Role Injection & Privilege Escalation Prevention', () => {
    it('prevents role tampering on signup payload', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'test-signup@example.com',
          password: 'SecurePassword123!',
          full_name: 'Privilege Attacker',
          role: 'ADMIN', // Tampering attempt
        });

      // Even if signup passes validation or fails at Supabase level,
      // it must NEVER result in an ADMIN user object
      if (res.status === 201) {
        assert.equal(res.body.data.user.role, 'USER', 'Role must remain USER');
      }
    });

    it('strictly rejects role injection in PUT /api/v1/auth/me (400 validation error)', async () => {
      const res = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer mock-test-token:${testUserId}`)
        .send({
          role: 'ADMIN', // Strictly forbidden field
        });

      assert.equal(res.status, 400, 'Attempt to inject role must trigger 400 validation rejection');
      assert.match(JSON.stringify(res.body), /unrecognized_keys|unexpected/i);
    });

    it('strictly rejects id tampering in PUT /api/v1/auth/me', async () => {
      const res = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer mock-test-token:${testUserId}`)
        .send({
          id: otherUserId, // Tampering attempt
        });

      assert.equal(res.status, 400, 'Attempt to overwrite user id must trigger 400 validation rejection');
    });
  });

  describe('3. Authenticated Profile Retrieval & Fail-Closed Behavior', () => {
    it('rejects unauthenticated GET /api/v1/auth/me with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      assert.equal(res.status, 401);
    });

    it('rejects unauthenticated PUT /api/v1/auth/me with 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/me')
        .send({ full_name: 'Unauthenticated User' });
      assert.equal(res.status, 401);
    });

    it('successfully returns authoritative profile for registered test user', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer mock-test-token:${testUserId}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, testUserId);
      assert.equal(res.body.data.role, 'USER');
    });

    it('fails closed (404) when profile does not exist in database', async () => {
      const unknownUserId = '99999999-9999-9999-9999-999999999999';
      // Note: unknownUserId is NOT registered in testUserRoles
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer mock-test-token:${unknownUserId}`);

      // Must fail closed with 404/500, never manufacture a fake profile
      assert.ok(res.status >= 400, 'Must fail closed for missing profile');
      assert.notEqual(res.body?.data?.profile_status, 'pending_onboarding');
    });
  });

  describe('4. Profile Update & Onboarding State', () => {
    it('successfully updates full_name and onboarding_completed for authenticated user', async () => {
      const res = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer mock-test-token:${testUserId}`)
        .send({
          full_name: 'Verified Onboarded User',
          onboarding_completed: true,
          preferred_language: 'en',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.full_name, 'Verified Onboarded User');
      assert.equal(res.body.data.onboarding_completed, true);
      assert.equal(res.body.data.role, 'USER', 'Role remains unchanged as USER');
    });
  });
});
