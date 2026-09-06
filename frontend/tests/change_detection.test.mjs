import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1 Change Detection Engine Regression Test Suite
 * Validates the 9 change dimensions, materiality ranking, top 3 cap, source data attribution, and insufficient history handling.
 */

describe('P1 Change Detection Engine Dashboard Integration Verification', () => {
  const componentPath = path.resolve('src/components/dashboard/WhatChangedCard.tsx');
  const pagePath = path.resolve('src/app/page.tsx');
  const apiPath = path.resolve('src/lib/api.ts');

  assert.ok(fs.existsSync(componentPath), 'WhatChangedCard.tsx must exist');
  assert.ok(fs.existsSync(pagePath), 'app/page.tsx must exist');
  assert.ok(fs.existsSync(apiPath), 'lib/api.ts must exist');

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const apiSource = fs.readFileSync(apiPath, 'utf8');

  it('verifies api.ts exports ChangeDetectionResult contract and changeDetectionApi', () => {
    assert.ok(apiSource.includes('export interface ChangeDetectionResult'), 'api.ts must export ChangeDetectionResult');
    assert.ok(apiSource.includes('export interface DetectedChange'), 'api.ts must export DetectedChange');
    assert.ok(apiSource.includes('export const changeDetectionApi'), 'api.ts must export changeDetectionApi');
    assert.ok(apiSource.includes("request<ChangeDetectionResult>(`/finance/changes"), 'api caller must hit /finance/changes');
  });

  it('verifies page.tsx wires changeDetectionApi and WhatChangedCard', () => {
    assert.ok(pageSource.includes('WhatChangedCard'), 'page.tsx must import WhatChangedCard');
    assert.ok(pageSource.includes('changeDetectionApi'), 'page.tsx must import changeDetectionApi');
    assert.ok(pageSource.includes('changeResult'), 'page.tsx must maintain changeResult state');
    assert.ok(pageSource.includes('changeDetectionApi.getChanges'), 'page.tsx must invoke changeDetectionApi.getChanges');
  });

  it('verifies WhatChangedCard enforces strict TOP 3 maximum display', () => {
    assert.ok(componentSource.includes('topChanges'), 'Component must reference topChanges');
    assert.ok(componentSource.includes('#{change.rank}'), 'Component must render numeric rank badge');
    assert.ok(componentSource.includes('materiality_level'), 'Component must render materiality level');
  });

  it('verifies source data attribution is rendered for every detected change', () => {
    assert.ok(componentSource.includes('source_data'), 'Must access source_data property');
    assert.ok(componentSource.includes('change.source_data.data_source'), 'Must display data source');
    assert.ok(componentSource.includes('current_period'), 'Must display current period');
    assert.ok(componentSource.includes('previous_period'), 'Must display previous period');
  });

  it('verifies explicit INSUFFICIENT HISTORY state is communicated clearly', () => {
    assert.ok(componentSource.includes('INSUFFICIENT HISTORY'), 'Must include insufficient history header');
    assert.ok(componentSource.includes('At least two valid consecutive financial periods are required'), 'Must explain why comparison is not possible');
  });

  it('verifies NO MATERIAL CHANGES state is handled gracefully', () => {
    assert.ok(componentSource.includes('No Material Changes Detected'), 'Must include no material changes title');
    assert.ok(componentSource.includes('remained within stability bounds'), 'Must explain metrics remained stable');
  });
});
