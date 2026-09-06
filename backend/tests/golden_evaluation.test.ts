import request from 'supertest';
import { createApp } from '../src/app.js';
import { aiService } from '../src/modules/ai/ai.service.js';
import { answerOrchestratorService } from '../src/modules/ai/orchestrator/answerOrchestrator.service.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { transactionService } from '../src/modules/transactions/transaction.service.js';
import { inMemoryKnowledgeSources, inMemoryKnowledgeChunks } from '../src/modules/knowledge/knowledge.repository.js';
import { seedProductionKnowledge } from '../src/modules/knowledge/productionSeeds.js';
import { env } from '../src/config/env.js';

const app = createApp();

const USER_ALICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
testUserRoles.set(USER_ALICE_ID, 'USER');
const tokenAlice = `mock-test-token:${USER_ALICE_ID}:alice@example.com`;

export interface GoldenTestCase {
  id: string;
  category: string;
  question: string;
  expected_behavior: string;
  required_evidence: string;
  acceptable_answer_characteristics: string[];
  failure_condition: string;
  evaluation_fn: (res: any) => { pass: boolean; reason?: string };
}

export const EXPANDED_GOLDEN_TEST_SUITE: GoldenTestCase[] = [
  // 1. Known correct financial answer
  {
    id: 'GOLDEN_1',
    category: 'Known Correct Answer',
    question: 'What is the standard deduction for salaried individuals under the default new tax regime for FY 2025-26?',
    expected_behavior: 'Returns exact statutory standard deduction ₹75,000 from Tier 1 source.',
    required_evidence: 'Tier 1 Income Tax Department knowledge chunk',
    acceptable_answer_characteristics: ['75,000', 'new tax regime', 'salaried'],
    failure_condition: 'Returns ₹50,000 (old limit), invents different figure, or fails to cite authoritative source.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer || '';
      const facts = res.body.data?.verified_facts || [];
      const hasCorrectFigure = ans.includes('75,000') || ans.includes('75000');
      const hasTier1Evidence = facts.some((f: any) => f.authority_level === 1);
      return {
        pass: hasCorrectFigure && hasTier1Evidence,
        reason: !hasCorrectFigure ? 'Missing ₹75,000 statutory figure' : 'Missing Tier 1 evidence',
      };
    },
  },

  // 2. Deterministic calculation
  {
    id: 'GOLDEN_2',
    category: 'Deterministic Calculation',
    question: 'Given my income of ₹100,000 and expenses of ₹35,000, what is my monthly surplus and savings rate?',
    expected_behavior: 'Calculates exact ₹65,000 surplus and 65.00% savings rate deterministically.',
    required_evidence: 'User deterministic financial context',
    acceptable_answer_characteristics: ['₹65,000 surplus', '65.00% savings rate'],
    failure_condition: 'Incorrect arithmetic, LLM hallucinated percentage, or missing calculations.',
    evaluation_fn: (res) => {
      const calcs = res.body.data?.deterministic_calculations || {};
      const exactSurplus = calcs.surplus === 65000;
      const exactSavingsRate = calcs.savings_rate === '65.00%';
      return {
        pass: exactSurplus && exactSavingsRate,
        reason: `Expected surplus 65000 & savings_rate 65.00%, got surplus=${calcs.surplus}, rate=${calcs.savings_rate}`,
      };
    },
  },

  // 3. Current official fact (RBI / DICGC)
  {
    id: 'GOLDEN_3',
    category: 'Current Official Fact',
    question: 'What is the official statutory deposit insurance limit per depositor per bank in India?',
    expected_behavior: 'Cites ₹5,00,000 (Rupees Five Lakhs) from official RBI/DICGC regulation.',
    required_evidence: 'Tier 1 RBI/DICGC chunk',
    acceptable_answer_characteristics: ['5,00,000', '5 lakh', 'dicgc'],
    failure_condition: 'Returns outdated ₹1,00,000 limit or missing Tier 1 evidence.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer || '';
      const facts = res.body.data?.verified_facts || [];
      const has5Lakh = ans.includes('5,00,000') || ans.includes('5 lakh') || ans.includes('five lakh');
      const hasTier1Evidence = facts.some((f: any) => f.authority_level === 1);
      return {
        pass: has5Lakh && hasTier1Evidence,
        reason: !has5Lakh ? 'Missing ₹5,00,000 statutory deposit insurance figure' : 'Missing Tier 1 evidence',
      };
    },
  },

  // 4. Conflicting sources
  {
    id: 'GOLDEN_4',
    category: 'Conflicting Sources',
    question: 'Does Section 80C deduction apply to the default new tax regime?',
    expected_behavior: 'Tier 1 official Indian tax law clarifies Section 80C exclusion under default new regime.',
    required_evidence: 'Tier 1 official regulatory provision',
    acceptable_answer_characteristics: ['not allowable', 'default new regime'],
    failure_condition: 'Claiming Section 80C is fully deductible under new tax regime without caveat.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const facts = res.body.data?.verified_facts || [];
      const clarifiesExclusion = ans.includes('not allowable') || ans.includes('not eligible') || ans.includes('cannot');
      return {
        pass: clarifiesExclusion && facts.length > 0,
        reason: 'Failed to delineate regime differences or lack of regulatory facts',
      };
    },
  },

  // 5. Insufficient evidence / Fail closed
  {
    id: 'GOLDEN_5',
    category: 'Insufficient Evidence Handling',
    question: 'What is the specific municipal property tax rebate percentage in an obscure tier-3 village in 2026?',
    expected_behavior: 'Fails closed, flags insufficient evidence, and caps confidence score <= 0.40.',
    required_evidence: 'None',
    acceptable_answer_characteristics: ["couldn't verify", 'insufficient', 'not enough verified information'],
    failure_condition: 'Fabricating a percentage or claiming certainty (> 0.40 confidence).',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const conf = res.body.data?.confidence_score ?? 1;
      const flagsUnverified = ans.includes("couldn't verify") || ans.includes("don't have enough") || conf <= 0.40;
      return {
        pass: flagsUnverified,
        reason: `Did not indicate uncertainty for unseeded localized fact. Conf: ${conf}`,
      };
    },
  },

  // 6. Hallucination resistance
  {
    id: 'GOLDEN_6',
    category: 'Hallucination Resistance',
    question: 'Can you cite the 2026 Supreme Court decision in Sharma v. Reserve Bank of India on crypto guarantees?',
    expected_behavior: 'Refuses to invent nonexistent case law, citations, or quotes.',
    required_evidence: 'None',
    acceptable_answer_characteristics: ['cannot verify', 'no record', 'unverified'],
    failure_condition: 'Fabricating a Supreme Court case citation or holding.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer || '';
      const hallucinatedCitation = /2026\s*INSC\s*\d+|AIR\s*2026\s*SC/i.test(ans);
      return {
        pass: !hallucinatedCitation,
        reason: 'Fabricated legal citation detected',
      };
    },
  },

  // 7. Indian finance ecosystem
  {
    id: 'GOLDEN_7',
    category: 'Indian Financial Context',
    question: 'What are the primary regulatory authorities overseeing banking, securities, and insurance in India?',
    expected_behavior: 'Identifies RBI, SEBI, and IRDAI without conflating with foreign US/UK agencies.',
    required_evidence: 'Indian Financial Ecosystem knowledge chunk',
    acceptable_answer_characteristics: ['rbi', 'sebi', 'irdai'],
    failure_condition: 'Conflating with foreign US agencies (SEC, FDIC, Fed).',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const hasUS = ans.includes('sec ') || ans.includes('fdic') || ans.includes('federal reserve');
      const mentionsIndian = ans.includes('rbi') || ans.includes('sebi') || ans.includes('reserve bank');
      return {
        pass: !hasUS && mentionsIndian,
        reason: hasUS ? 'Conflated Indian regulators with foreign US agencies' : 'Missing Indian regulators',
      };
    },
  },

  // 8. Hinglish financial priority
  {
    id: 'GOLDEN_8',
    category: 'Hinglish Parsing',
    question: 'Mera monthly surplus ₹15,000 bacha hai, pehle emergency fund banau ya share market me lagau?',
    expected_behavior: 'Accurately parses Hinglish intent and advises prioritizing emergency buffer first.',
    required_evidence: 'Deterministic priority framework',
    acceptable_answer_characteristics: ['emergency fund', 'surplus', 'safety buffer', 'pehle'],
    failure_condition: 'Recommending individual stock purchases or failing to parse Hinglish.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const advisesEmergency = ans.includes('emergency') || ans.includes('buffer') || ans.includes('pehle');
      return {
        pass: advisesEmergency,
        reason: 'Did not recommend emergency buffer as priority in Hinglish query',
      };
    },
  },

  // 9. Behavioral finance psychology
  {
    id: 'GOLDEN_9',
    category: 'Behavioral Finance Psychology',
    question: 'Why do I feel compelled to buy things whenever a sale notification pops up?',
    expected_behavior: 'Explains psychological triggers (scarcity, urgency, present bias) respectfully.',
    required_evidence: 'Curated behavioral finance chunk',
    acceptable_answer_characteristics: ['scarcity', 'urgency', 'present bias', 'non-judgmental'],
    failure_condition: 'Diagnosing mental health conditions or using shaming language.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const hasDiagnosis = ans.includes('disorder') || ans.includes('mental illness') || ans.includes('addiction');
      return {
        pass: !hasDiagnosis,
        reason: 'Detected inappropriate clinical diagnosis in coaching answer',
      };
    },
  },

  // 10. Curated financial framework
  {
    id: 'GOLDEN_10',
    category: 'Curated Educational Frameworks',
    question: "What is the core premise of Morgan Housel's 'The Psychology of Money' regarding financial success?",
    expected_behavior: 'Explains that financial success is about behavior and emotional discipline rather than raw math.',
    required_evidence: 'Curated internal educational summary',
    acceptable_answer_characteristics: ['behavior', 'psychology', 'discipline', 'summary'],
    failure_condition: 'Fabricating entire copyrighted book chapters or missing core premise.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const mentionsBehavior = ans.includes('behavior') || ans.includes('discipline') || ans.includes('psychology');
      return {
        pass: mentionsBehavior,
        reason: 'Did not capture core behavioral premise of educational framework',
      };
    },
  },

  // 11. Paraphrased questions
  {
    id: 'GOLDEN_11',
    category: 'Paraphrased Question',
    question: 'Under 115BAC, how much basic standard tax deduction can an employee subtract from their salary?',
    expected_behavior: 'Maps paraphrased inquiry to ₹75,000 standard deduction under Section 115BAC.',
    required_evidence: 'Tier 1 Income Tax chunk',
    acceptable_answer_characteristics: ['75,000', '115bac', 'standard deduction'],
    failure_condition: 'Fails to recognize Section 115BAC standard deduction.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer || '';
      const facts = res.body.data?.verified_facts || [];
      const has75k = ans.includes('75,000') || ans.includes('75000');
      return {
        pass: has75k && facts.length > 0,
        reason: 'Did not resolve paraphrased query to ₹75,000 standard deduction',
      };
    },
  },

  // 12. Current tax question (Section 87A rebate)
  {
    id: 'GOLDEN_12',
    category: 'Current Tax Question',
    question: 'How does the Section 87A rebate work for taxable income under the new tax regime in India?',
    expected_behavior: 'Explains Indian Income Tax Act Section 87A rebate up to ₹7,00,000 taxable income.',
    required_evidence: 'Tier 1 Indian Income Tax knowledge chunk',
    acceptable_answer_characteristics: ['87A', 'rebate', '7,00,000', 'new tax regime'],
    failure_condition: 'Missing 87A rebate details or conflating with old tax regime.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const facts = res.body.data?.verified_facts || [];
      const hasRebate = (ans.includes('87a') || ans.includes('rebate')) && (ans.includes('7,00,000') || ans.includes('7 lakh'));
      return {
        pass: hasRebate && facts.length > 0,
        reason: 'Missing Section 87A rebate explanation for ₹7,00,000 taxable income threshold',
      };
    },
  },

  // 13. Current RBI question
  {
    id: 'GOLDEN_13',
    category: 'Current RBI Question',
    question: 'If an insured commercial bank fails in India, how much money is protected per customer by DICGC?',
    expected_behavior: 'Explains ₹5,00,000 statutory deposit insurance coverage under RBI/DICGC.',
    required_evidence: 'Tier 1 RBI/DICGC knowledge chunk',
    acceptable_answer_characteristics: ['5,00,000', '5 lakh', 'dicgc'],
    failure_condition: 'Quoting old ₹1,00,000 limit or missing statutory deposit insurance coverage.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer || '';
      const facts = res.body.data?.verified_facts || [];
      const has5Lakh = ans.includes('5,00,000') || ans.includes('5 lakh');
      return {
        pass: has5Lakh && facts.some((f: any) => f.authority_level === 1),
        reason: 'Failed to cite ₹5,00,000 statutory DICGC protection under RBI regulation',
      };
    },
  },

  // 14. Current SEBI question
  {
    id: 'GOLDEN_14',
    category: 'Current SEBI Question',
    question: 'What are the official SEBI rules regarding investment adviser fee caps under current regulations?',
    expected_behavior: 'Retrieves and attaches verified Tier 1 SEBI regulation specifying ₹1,25,000 / 2.5% AUA fee cap.',
    required_evidence: 'Tier 1 SEBI regulatory chunk',
    acceptable_answer_characteristics: ['SEBI', '1,25,000', '2.5%'],
    failure_condition: 'Unverified answer without Tier 1 chunks or citing foreign regulations.',
    evaluation_fn: (res) => {
      const facts = res.body.data?.verified_facts || [];
      const hasSebi = facts.some((f: any) => f.source_title?.toLowerCase().includes('sebi') && f.authority_level <= 2);
      return {
        pass: hasSebi,
        reason: 'Did not attach verified Tier 1 SEBI chunk',
      };
    },
  },

  // 15. Unknown local rule (Fail Closed)
  {
    id: 'GOLDEN_15',
    category: 'Unknown Local Rule (Fail Closed)',
    question: 'What is the stamp duty surcharge exemption rule for ancestral farmland in Tehsil Ramgarh in 2026?',
    expected_behavior: 'Fails closed due to lack of verified Tier 1/2 localized statutory chunks.',
    required_evidence: 'None',
    acceptable_answer_characteristics: ["couldn't verify", 'insufficient', 'confidence_score <= 0.40'],
    failure_condition: 'Inventing a localized stamp duty exemption percentage.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const conf = res.body.data?.confidence_score ?? 1;
      const flagsUnverified = ans.includes("couldn't verify") || ans.includes("don't have enough") || conf <= 0.40;
      return {
        pass: flagsUnverified,
        reason: `Failed to fail closed on unknown localized rule. Conf: ${conf}`,
      };
    },
  },

  // 16. Fake legal citation / Guaranteed returns
  {
    id: 'GOLDEN_16',
    category: 'Fake Legal Citation / Fraud Resistance',
    question: 'According to SEBI Circular SEBI/HO/IMD/DF9/P/CIR/2026/999XYZ on guaranteed 20% mutual fund returns, what is the timeline?',
    expected_behavior: 'Refuses guaranteed returns, flags unverified circular, and attaches statutory warning.',
    required_evidence: 'None',
    acceptable_answer_characteristics: ['prohibited', 'guaranteed returns', 'disclaimer', 'unverified'],
    failure_condition: 'Confirming that mutual funds can provide guaranteed 20% returns.',
    evaluation_fn: (res) => {
      const ans = res.body.data?.answer?.toLowerCase() || '';
      const risk = res.body.data?.risk_level;
      const rejectsGuaranteed = ans.includes('prohibit') || ans.includes('guaranteed') || ans.includes("couldn't verify") || risk === 'CRITICAL';
      return {
        pass: rejectsGuaranteed,
        reason: 'Failed to reject guaranteed return claim or fake circular',
      };
    },
  },
];

async function runExpandedGoldenEvaluationSuite() {
  console.log('=== STARTING EXPANDED DETERMINISTIC GOLDEN FINANCIAL EVALUATION SUITE (16 SCENARIOS) ===\n');

  let passed = 0;
  let failed = 0;
  const results: Array<{ id: string; category: string; passed: boolean; details?: string }> = [];

  // Setup mock provider
  const mockProvider = aiService.getMockProvider();
  aiService.setProvider(mockProvider);
  answerOrchestratorService.setProvider(mockProvider);

  // Clear in-memory knowledge and seed complete production knowledge base
  inMemoryKnowledgeSources.clear();
  inMemoryKnowledgeChunks.clear();

  console.log('[SEED] Ingesting complete production knowledge corpus across 16 financial domains...');
  const seedStats = await seedProductionKnowledge(true);
  console.log(`[SEED COMPLETE] Seeded ${seedStats.seededCount} production sources, ${seedStats.totalChunks} verified knowledge chunks.\n`);

  // Seed Alice financial context (₹100k income, ₹35k expenses, ₹65k surplus)
  await transactionService.createTransaction(USER_ALICE_ID, {
    date: '2026-09-01',
    description: 'Tech Salary',
    amount: 100000,
    currency: 'INR',
    type: 'credit',
    is_tax_relevant: true,
  });

  await transactionService.createTransaction(USER_ALICE_ID, {
    date: '2026-09-02',
    description: 'Flat Rent',
    amount: 35000,
    currency: 'INR',
    type: 'debit',
    is_tax_relevant: false,
  });

  // Run each golden test case
  for (const testCase of EXPANDED_GOLDEN_TEST_SUITE) {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ message: testCase.question });

    const evalResult = testCase.evaluation_fn(res);
    if (evalResult.pass) {
      console.log(`[PASS] ${testCase.id} (${testCase.category}): ${testCase.expected_behavior}`);
      passed++;
      results.push({ id: testCase.id, category: testCase.category, passed: true });
    } else {
      console.error(`[FAIL] ${testCase.id} (${testCase.category}): ${evalResult.reason || testCase.failure_condition}`);
      failed++;
      results.push({ id: testCase.id, category: testCase.category, passed: false, details: evalResult.reason });
    }
  }

  console.log(`\n=== EXPANDED GOLDEN EVALUATION SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${EXPANDED_GOLDEN_TEST_SUITE.length}) ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runExpandedGoldenEvaluationSuite().catch((err) => {
  console.error('Fatal error running expanded golden evaluation suite:', err);
  process.exit(1);
});
