import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1 Mobile UX Hardening & Breakpoint Verification Test Suite
 * Validates responsive rules, primary navigation priority, touch targets, and layout safety.
 */

describe('P1 Mobile UX Hardening Verification', () => {
  const globalsCssPath = path.resolve('src/app/globals.css');
  const commandSpinePath = path.resolve('src/components/layout/CommandSpine.tsx');
  const pagePath = path.resolve('src/app/page.tsx');
  const crorePath = path.resolve('src/app/crore/page.tsx');
  const ledgerPath = path.resolve('src/app/ledger/page.tsx');

  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
  const commandSpine = fs.readFileSync(commandSpinePath, 'utf8');
  const dashboard = fs.readFileSync(pagePath, 'utf8');
  const crorePage = fs.readFileSync(crorePath, 'utf8');
  const ledgerPage = fs.readFileSync(ledgerPath, 'utf8');

  it('verifies responsive breakpoints are properly defined in globals.css', () => {
    const requiredBreakpoints = ['1024px', '900px', '768px', '430px', '390px', '375px'];
    for (const bp of requiredBreakpoints) {
      assert.ok(
        globalsCss.includes(`@media (max-width: ${bp})`),
        `globals.css must define responsive media query for ${bp}`
      );
    }
  });

  it('verifies mobile navigation prioritizes HOME, MONEY, ₹1 CRORE, and MYCA', () => {
    // Check CommandSpine mobile primary navigation array
    assert.ok(commandSpine.includes("label: 'HOME'"));
    assert.ok(commandSpine.includes("label: 'MONEY'"));
    assert.ok(commandSpine.includes("label: '₹1 CRORE'"));
    assert.ok(commandSpine.includes("label: 'MYCA'"));
    assert.ok(commandSpine.includes("MORE"));

    // Check secondary features are behind contextual drawer
    assert.ok(commandSpine.includes('mobileSecondary'));
    assert.ok(commandSpine.includes('/plan'));
    assert.ok(commandSpine.includes('/vault'));
    assert.ok(commandSpine.includes('/statements'));
  });

  it('verifies touch targets enforce minimum accessible dimensions (>= 44px)', () => {
    assert.ok(
      globalsCss.includes('min-height: 44px'),
      'globals.css must enforce min-height: 44px for touch targets'
    );
    assert.ok(
      commandSpine.includes("minHeight: '44px'"),
      'CommandSpine mobile navigation must enforce minHeight 44px on tap targets'
    );
    assert.ok(
      commandSpine.includes("minWidth: '44px'"),
      'CommandSpine mobile navigation must enforce minWidth 44px on tap targets'
    );
  });

  it('verifies no rigid pixel grid widths causing horizontal overflow on 375px screens', () => {
    // In crore page, minmax should not exceed 280px or use min(100%, ...)
    assert.ok(
      !crorePage.includes('minmax(320px, 1fr)'),
      'crore/page.tsx must not use rigid minmax(320px, 1fr) which overflows 375px screens'
    );
    assert.ok(
      crorePage.includes('minmax(min(100%, 280px), 1fr)'),
      'crore/page.tsx must use responsive minmax'
    );

    // In ledger, table must have horizontal scroll wrapper
    assert.ok(
      ledgerPage.includes("overflowX: 'auto'"),
      'ledger/page.tsx table must be wrapped in overflowX: auto'
    );
  });

  it('verifies dashboard outcome-first hierarchy and source precedence', () => {
    // 1. HOW AM I DOING?
    assert.ok(dashboard.includes('1. How Am I Doing?'));
    assert.ok(dashboard.includes('Money In'));
    assert.ok(dashboard.includes('Money Out'));
    assert.ok(dashboard.includes('Money Left'));
    assert.ok(dashboard.includes('Savings Rate'));

    // Source badges
    assert.ok(dashboard.includes('Observed Ledger'));
    assert.ok(dashboard.includes('Stated Baseline'));

    // 2. WHAT CHANGED?
    assert.ok(dashboard.includes('2. What Changed?'));

    // 3. WHAT SHOULD I DO NEXT?
    assert.ok(dashboard.includes('3. What Should I Do Next?'));

    // 4. HOW CLOSE AM I TO ₹1 CRORE?
    assert.ok(dashboard.includes('4. How Close Am I to ₹1 Crore?'));
  });

  it('verifies UNKNOWN != ZERO handling in frontend dashboard', () => {
    // When income or expenses are null, dashboard renders 'UNKNOWN'
    assert.ok(dashboard.includes("income !== null ? `₹${income.toLocaleString('en-IN')}` : 'UNKNOWN'"));
    assert.ok(dashboard.includes("expenses !== null ? `₹${expenses.toLocaleString('en-IN')}` : 'UNKNOWN'"));
    assert.ok(dashboard.includes("surplus === null\n                    ? 'UNKNOWN'"));
  });
});
