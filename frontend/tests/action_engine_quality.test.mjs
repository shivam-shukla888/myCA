import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1 Action Engine Quality Frontend Integration Test Suite
 * Validates the single highest-priority action, priority hierarchy, calculable expected effect,
 * CTA binding, source attribution, and zero manipulative phrasing.
 */

describe('MYCA P1 Action Engine Quality Frontend Integration', () => {
  const apiPath = path.resolve('src/lib/api.ts');
  const dashboardPath = path.resolve('src/app/page.tsx');
  const planPath = path.resolve('src/app/plan/page.tsx');

  assert.ok(fs.existsSync(apiPath), 'lib/api.ts must exist');
  assert.ok(fs.existsSync(dashboardPath), 'app/page.tsx must exist');
  assert.ok(fs.existsSync(planPath), 'app/plan/page.tsx must exist');

  const apiSource = fs.readFileSync(apiPath, 'utf8');
  const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
  const planSource = fs.readFileSync(planPath, 'utf8');

  it('verifies api.ts defines HighestPriorityAction and HighestActionPriorityType', () => {
    assert.ok(apiSource.includes('export type HighestActionPriorityType'), 'api.ts must export HighestActionPriorityType');
    assert.ok(apiSource.includes('P0_DEFICIT'), 'Must support P0_DEFICIT');
    assert.ok(apiSource.includes('P1_EMERGENCY_GAP'), 'Must support P1_EMERGENCY_GAP');
    assert.ok(apiSource.includes('P2_HIGH_COST_OBLIGATIONS'), 'Must support P2_HIGH_COST_OBLIGATIONS');
    assert.ok(apiSource.includes('P3_INSUFFICIENT_BUFFER'), 'Must support P3_INSUFFICIENT_BUFFER');
    assert.ok(apiSource.includes('P4_GOAL_CONTRIBUTION'), 'Must support P4_GOAL_CONTRIBUTION');
    assert.ok(apiSource.includes('P5_WEALTH_ACCELERATION'), 'Must support P5_WEALTH_ACCELERATION');

    assert.ok(apiSource.includes('export interface HighestPriorityAction'), 'api.ts must export HighestPriorityAction');
    assert.ok(apiSource.includes('expected_measurable_effect: string;'), 'Must have expected_measurable_effect field');
    assert.ok(apiSource.includes('confidence_source:'), 'Must have confidence_source');
    assert.ok(apiSource.includes('highest_priority_action?: HighestPriorityAction;'), 'ActionPlan must include highest_priority_action');
  });

  it('verifies dashboard page.tsx binds Action Engine highest_priority_action to Level 3', () => {
    assert.ok(dashboardSource.includes('actionApi.getPlan(currentMonth)'), 'Dashboard must fetch actionApi.getPlan');
    assert.ok(dashboardSource.includes('highestAction = actionPlan?.highest_priority_action'), 'Dashboard must inspect highestAction');
    assert.ok(dashboardSource.includes('Single Highest-Priority Action'), 'Section 3 header must indicate single highest-priority action');
    assert.ok(dashboardSource.includes('Expected Measurable Effect'), 'Section 3 must highlight Expected Measurable Effect');
    assert.ok(dashboardSource.includes('primaryFocusEffect'), 'Must render primaryFocusEffect');
  });

  it('verifies plan page.tsx renders dedicated ONE HIGHEST-PRIORITY ACTION card', () => {
    assert.ok(planSource.includes('ONE HIGHEST-PRIORITY ACTION'), 'Plan page must highlight ONE HIGHEST-PRIORITY ACTION');
    assert.ok(planSource.includes('highest_priority_action.expected_measurable_effect'), 'Plan page must render expected_measurable_effect');
    assert.ok(planSource.includes('highest_priority_action.confidence_source.data_source'), 'Plan page must attribute confidence source');
    assert.ok(planSource.includes('highest_priority_action.cta.destination'), 'Plan page must link to action CTA');
  });

  it('verifies that vague non-calculable advice like "Save more" is eliminated', () => {
    assert.ok(!dashboardSource.includes('"Save more."'), 'Dashboard must not use vague "Save more."');
    assert.ok(!planSource.includes('"Save more."'), 'Plan page must not use vague "Save more."');
    assert.ok(!apiSource.includes('"Save more."'), 'API must not use vague "Save more."');
  });
});
