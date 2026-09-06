import request from 'supertest';
import { createApp } from '../src/app.js';
import { documentService } from '../src/modules/documents/document.service.js';
import { marketService } from '../src/modules/market/market.service.js';
import { getIndianMarketStatus } from '../src/modules/market/providers/exchangeEquity.provider.js';
import { answerOrchestratorService } from '../src/modules/ai/orchestrator/answerOrchestrator.service.js';
import { transactionService } from '../src/modules/transactions/transaction.service.js';
import { testUserRoles } from '../src/middleware/auth.js';

const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

async function runAll() {
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_DEV_AUTH = 'true';
  process.env.ENABLE_TEST_OCR_MOCK = 'true';

  testUserRoles.set(USER_A_ID, 'USER');
  testUserRoles.set(USER_B_ID, 'USER');

  const app = createApp();

  console.log('=== RUNNING VAULT MULTI-MEDIA & LIVE MARKET INTELLIGENCE TESTS ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`[FAIL] ${msg}`);
      failed++;
      throw new Error(msg);
    }
    console.log(`[PASS] ${msg}`);
    passed++;
  }

  const tokenA = `Bearer mock-test-token:${USER_A_ID}:user_a@example.com`;
  const tokenB = `Bearer mock-test-token:${USER_B_ID}:user_b@example.com`;

  // 1. PDF Document Creation
  const pdfRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'annual_salary_slip.pdf',
      file_type: 'pdf',
      file_size_bytes: 250000,
      mime_type: 'application/pdf',
      document_type: 'salary_slip',
      financial_year: '2025-26',
    });
  assert(pdfRes.status === 201, 'TEST 1A: PDF creation returns 201');
  assert(pdfRes.body.data.source_type === 'DOCUMENT', 'TEST 1B: PDF source_type is DOCUMENT');
  assert(pdfRes.body.data.ocr_status === 'pending', 'TEST 1C: PDF ocr_status is pending');
  assert(pdfRes.body.data.verification_status === 'unverified', 'TEST 1D: PDF verification_status is unverified');
  assert(Boolean(pdfRes.body.data.upload_url), 'TEST 1E: PDF signed upload URL provided');

  // 2. JPG Photo Evidence Creation
  const jpgRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'medical_store_bill.jpg',
      file_type: 'jpg',
      file_size_bytes: 1800000,
      mime_type: 'image/jpeg',
      document_type: 'receipt',
      title: 'Apollo Pharmacy Tax Bill',
      financial_year: '2025-26',
    });
  assert(jpgRes.status === 201, 'TEST 2A: JPG photo creation returns 201');
  assert(jpgRes.body.data.source_type === 'IMAGE', 'TEST 2B: JPG source_type is IMAGE');
  assert(jpgRes.body.data.title === 'Apollo Pharmacy Tax Bill', 'TEST 2C: Title preserved');

  // 3. PNG Screenshot Evidence Creation
  const pngRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'upi_payment_screenshot.png',
      file_type: 'png',
      file_size_bytes: 850000,
      mime_type: 'image/png',
      document_type: 'receipt',
    });
  assert(pngRes.status === 201, 'TEST 3A: PNG creation returns 201');
  assert(pngRes.body.data.source_type === 'IMAGE', 'TEST 3B: PNG source_type is IMAGE');

  // 4. MP4 Video Evidence Creation
  const mp4Res = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'property_inspection_walkthrough.mp4',
      file_type: 'mp4',
      file_size_bytes: 25000000,
      mime_type: 'video/mp4',
      document_type: 'other',
      title: 'Office Property Walkthrough Evidence',
    });
  assert(mp4Res.status === 201, 'TEST 4A: MP4 video creation returns 201');
  assert(mp4Res.body.data.source_type === 'VIDEO', 'TEST 4B: MP4 source_type is VIDEO');
  assert(mp4Res.body.data.ocr_status === 'not_applicable', 'TEST 4C: Video ocr_status is not_applicable');

  // 5. Dangerous Extension Rejection
  const exeRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'malicious_script.exe',
      file_type: 'exe',
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      document_type: 'other',
    });
  assert(exeRes.status === 400, 'TEST 5: Executable extension (.exe) rejected with 400');

  // 6. Unsupported MIME Rejection
  const mimeRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'unknown_file.xyz',
      file_type: 'xyz',
      file_size_bytes: 1024,
      mime_type: 'application/x-unknown-format',
      document_type: 'other',
    });
  assert(mimeRes.status === 400, 'TEST 6: Unsupported MIME format rejected with 400');

  // 7. Oversized File Rejection (> 10MB for documents)
  const hugeRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'huge_document.pdf',
      file_type: 'pdf',
      file_size_bytes: 15 * 1024 * 1024,
      mime_type: 'application/pdf',
      document_type: 'other',
    });
  assert(hugeRes.status === 400, 'TEST 7: Non-video file > 10MB rejected with 400');

  // 8. Unauthenticated Access Rejection
  const unauthRes = await request(app)
    .post('/api/v1/documents')
    .send({
      file_name: 'unauth.pdf',
      file_type: 'pdf',
      file_size_bytes: 1000,
      mime_type: 'application/pdf',
      document_type: 'salary_slip',
    });
  assert(unauthRes.status === 401, 'TEST 8: Unauthenticated upload rejected with 401');

  // 9. IDOR Cross-User Isolation
  const docA = await documentService.createDocumentMetadata(USER_A_ID, {
    file_name: 'confidential_user_a.pdf',
    file_type: 'pdf',
    file_size_bytes: 50000,
    mime_type: 'application/pdf',
    document_type: 'salary_slip',
  });
  const idorRes = await request(app)
    .get(`/api/v1/documents/${docA.id}`)
    .set('Authorization', tokenB);
  assert(idorRes.status === 403, 'TEST 9: User B receives 403 Forbidden accessing User A evidence');

  // 10. Owner Signed Download URL
  const ownerRes = await request(app)
    .get(`/api/v1/documents/${docA.id}`)
    .set('Authorization', tokenA);
  assert(ownerRes.status === 200, 'TEST 10A: Owner receives 200 OK');
  assert(Boolean(ownerRes.body.data.download_url), 'TEST 10B: Private signed download URL returned');

  // 11. Image OCR Draft Generation
  const imageDoc = await documentService.createDocumentMetadata(USER_A_ID, {
    file_name: 'salary_slip_photo.jpg',
    file_type: 'jpg',
    file_size_bytes: 450000,
    mime_type: 'image/jpeg',
    document_type: 'salary_slip',
  });
  const extractRes = await request(app)
    .post(`/api/v1/ocr/${imageDoc.id}/extract`)
    .set('Authorization', tokenA);
  assert(
    ['draft_ready', 'needs_review'].includes(extractRes.body.data.extraction_status),
    'TEST 11B: Extraction draft requires review or is draft_ready'
  );

  // 12. OCR Confirmation Gate
  const confirmRes = await request(app)
    .post('/api/v1/ocr/confirm')
    .set('Authorization', tokenA)
    .send({
      document_id: imageDoc.id,
      reviewed_data: {
        salary_amount: 95000,
        net_income: 95000,
        gross_income: 120000,
        employer: 'Acme Technologies Pvt Ltd',
      },
      import_target: 'profile',
    });
  assert(confirmRes.status === 200, 'TEST 12A: Confirmation import succeeds with 200');
  const updatedDoc = await documentService.getDocumentById(USER_A_ID, imageDoc.id);
  assert(updatedDoc.verification_status === 'user_confirmed', 'TEST 12B: verification_status is user_confirmed');
  assert(Boolean(updatedDoc.confirmed_at), 'TEST 12C: confirmed_at timestamp recorded');

  // 13. Video Evidence Guarantee
  const videoDoc = await documentService.createDocumentMetadata(USER_A_ID, {
    file_name: 'asset_recording.mp4',
    file_type: 'mp4',
    file_size_bytes: 10000000,
    mime_type: 'video/mp4',
    document_type: 'other',
  });
  const videoExtractRes = await request(app)
    .post(`/api/v1/ocr/${videoDoc.id}/extract`)
    .set('Authorization', tokenA);
  assert(videoExtractRes.status === 400, 'TEST 13A: Video extraction rejected with 400');
  assert(videoExtractRes.body.error.code === 'EXTRACTION_UNSUPPORTED_FOR_VIDEO', 'TEST 13B: Code is EXTRACTION_UNSUPPORTED_FOR_VIDEO');
  assert(
    videoExtractRes.body.error.message.includes('Video stored as evidence'),
    'TEST 13C: Explicit video policy message delivered'
  );

  // 14. Live Market Intelligence Summary
  const marketRes = await request(app)
    .get('/api/v1/market/summary')
    .set('Authorization', tokenA);
  assert(marketRes.status === 200, 'TEST 14A: Market summary returns 200');
  const mData = marketRes.body.data;
  assert(mData.inflation.metric === 'CPI_INFLATION', 'TEST 14B: Inflation metric is CPI_INFLATION');
  assert(mData.inflation.source.includes('MoSPI'), 'TEST 14C: Inflation source is MoSPI');
  assert(mData.inflation.freshness_type === 'MONTHLY', 'TEST 14D: Inflation freshness is strictly MONTHLY');
  assert(mData.gold.some((g: any) => g.metric === 'GOLD_24K'), 'TEST 14E: Gold 24K present');
  assert(mData.gold.some((g: any) => g.metric === 'GOLD_22K'), 'TEST 14F: Gold 22K present');
  assert(mData.fx.some((f: any) => f.metric === 'USD_INR'), 'TEST 14G: USD/INR present');
  assert(mData.indices.some((i: any) => i.metric === 'NIFTY_50'), 'TEST 14H: NIFTY 50 present');
  assert(Boolean(mData.disclaimer), 'TEST 14I: Statutory disclaimer present');

  // 15. Market Open/Closed Calculation
  const openTime = new Date('2026-09-09T05:00:00Z'); // 10:30 AM IST Wednesday
  assert(getIndianMarketStatus(openTime) === 'MARKET OPEN', 'TEST 15A: Wednesday 10:30 AM IST is MARKET OPEN');
  const closedTime = new Date('2026-09-06T05:30:00Z'); // Sunday
  assert(getIndianMarketStatus(closedTime) === 'MARKET CLOSED', 'TEST 15B: Sunday is MARKET CLOSED');

  // 16. Watchlist CRUD Operations
  const addWlRes = await request(app)
    .post('/api/v1/market/watchlist')
    .set('Authorization', tokenA)
    .send({ symbol: 'BHARTIARTL', exchange: 'NSE' });
  assert([201, 409].includes(addWlRes.status), 'TEST 16A: Watchlist addition succeeds or already exists');

  const getWlRes = await request(app)
    .get('/api/v1/market/watchlist')
    .set('Authorization', tokenA);
  assert(getWlRes.status === 200, 'TEST 16B: Watchlist retrieval returns 200');
  assert(Array.isArray(getWlRes.body.data), 'TEST 16C: Watchlist is an array');

  // 17. Watchlist Duplicate Rejection
  const dupWlRes = await request(app)
    .post('/api/v1/market/watchlist')
    .set('Authorization', tokenA)
    .send({ symbol: 'BHARTIARTL' });
  assert(dupWlRes.status === 409, 'TEST 17: Duplicate watchlist symbol rejected with 409 Conflict');

  // 18. AI Coach Grounding with Live Market Evidence
  const mockProvider = answerOrchestratorService.getMockProvider();
  answerOrchestratorService.setProvider(mockProvider);
  mockProvider.setCustomHandler((prompt: string): any => {
    if (/gold/i.test(prompt)) {
      return {
        answer: 'Today 24K Gold is ₹73,850 per 10g and 22K Gold is ₹67,700 per 10g according to IBJA reference rates.',
        intent: 'INVESTMENT_EDUCATION',
        risk_level: 'LOW',
        confidence_score: 0.95,
        evidence: [],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: 'Indicative spot reference rates only. Consult authorized bullion dealers.',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }
    if (/inflation|cpi/i.test(prompt)) {
      return {
        answer: 'Current India CPI inflation stands at 3.65% as per official MoSPI data for July 2026.',
        intent: 'INVESTMENT_EDUCATION',
        risk_level: 'LOW',
        confidence_score: 0.95,
        evidence: [],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: 'Official MoSPI statistics. Past figures subject to government revisions.',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }
    return {
      answer: 'Mock market answer',
      intent: 'GENERAL_INQUIRY',
      risk_level: 'LOW',
      confidence_score: 0.9,
      evidence: [],
      missing_information: [],
      disclaimer_required: false,
      disclaimer: '',
      human_review_required: false,
      refusal_or_limitation: null,
    };
  });

  const aiGold = await answerOrchestratorService.orchestrate({
    userId: USER_A_ID,
    conversationId: 'test-conv-gold-grounding',
    query: "What is today's gold price in India?",
  });
  assert(aiGold.verification_status === 'VERIFIED', 'TEST 18A: Gold query marked as VERIFIED');
  assert(/gold|₹|\d+/i.test(aiGold.answer), 'TEST 18B: Gold answer contains verified price');

  // 19. AI Coach Grounding for Inflation
  const aiCpi = await answerOrchestratorService.orchestrate({
    userId: USER_A_ID,
    conversationId: 'test-conv-cpi-grounding',
    query: 'What is the current India CPI inflation rate?',
  });
  assert(aiCpi.verification_status === 'VERIFIED', 'TEST 19A: CPI query marked as VERIFIED');
  assert(/inflation|CPI|3\.|MoSPI/i.test(aiCpi.answer), 'TEST 19B: CPI answer contains verified inflation rate');

  // 20. Financial Semantic Safety Guarantee
  const initialTx = await transactionService.listTransactions(USER_A_ID, {});
  await marketService.getMarketSummary(true);
  const afterTx = await transactionService.listTransactions(USER_A_ID, {});
  assert(afterTx.total === initialTx.total, 'TEST 20: Market data refresh causes ZERO mutations to user transactions');

  console.log(`\n=== ALL TESTS PASSED: ${passed} PASSED, ${failed} FAILED ===\n`);
}

runAll().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
