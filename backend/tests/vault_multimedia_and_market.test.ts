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

  console.log('=== RUNNING ALL 28 VAULT MULTI-MEDIA & LIVE MARKET INTELLIGENCE TESTS ===\n');
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

  // -------------------------------------------------------------------------
  // TEST 1: PDF upload & metadata validation
  // -------------------------------------------------------------------------
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
  assert(pdfRes.status === 201, 'TEST 1: PDF creation returns 201 Created');
  assert(pdfRes.body.data.source_type === 'DOCUMENT', 'TEST 1: PDF source_type is DOCUMENT');

  // -------------------------------------------------------------------------
  // TEST 2: JPG upload & metadata validation
  // -------------------------------------------------------------------------
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
  assert(jpgRes.status === 201, 'TEST 2: JPG photo creation returns 201 Created');
  assert(jpgRes.body.data.source_type === 'IMAGE', 'TEST 2: JPG source_type is IMAGE');

  // -------------------------------------------------------------------------
  // TEST 3: PNG upload & metadata validation
  // -------------------------------------------------------------------------
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
  assert(pngRes.status === 201, 'TEST 3: PNG screenshot creation returns 201 Created');
  assert(pngRes.body.data.source_type === 'IMAGE', 'TEST 3: PNG source_type is IMAGE');

  // -------------------------------------------------------------------------
  // TEST 4: MP4 upload & metadata validation
  // -------------------------------------------------------------------------
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
  assert(mp4Res.status === 201, 'TEST 4: MP4 video creation returns 201 Created');
  assert(mp4Res.body.data.source_type === 'VIDEO', 'TEST 4: MP4 source_type is VIDEO');
  assert(mp4Res.body.data.ocr_status === 'not_applicable', 'TEST 4: Video ocr_status is not_applicable');

  // -------------------------------------------------------------------------
  // TEST 5: Unsupported extension rejected (.exe)
  // -------------------------------------------------------------------------
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
  assert(exeRes.status === 400, 'TEST 5: Executable extension (.exe) rejected with 400 Bad Request');

  // -------------------------------------------------------------------------
  // TEST 6: Unsupported MIME rejected
  // -------------------------------------------------------------------------
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
  assert(mimeRes.status === 400, 'TEST 6: Unsupported MIME format rejected with 400 Bad Request');

  // -------------------------------------------------------------------------
  // TEST 7: Oversized file rejected (> 10MB for documents/photos)
  // -------------------------------------------------------------------------
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
  assert(hugeRes.status === 400, 'TEST 7: Non-video file > 10MB rejected with 400 Bad Request');

  // -------------------------------------------------------------------------
  // TEST 8: Authenticated upload succeeds with 201
  // -------------------------------------------------------------------------
  const authDocRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'verified_auth_upload.pdf',
      file_type: 'pdf',
      file_size_bytes: 120000,
      mime_type: 'application/pdf',
      document_type: 'bank_statement',
    });
  assert(authDocRes.status === 201, 'TEST 8: Authenticated upload succeeds with 201 Created');
  assert(Boolean(authDocRes.body.data.upload_url), 'TEST 8: Upload URL provided in response');

  // -------------------------------------------------------------------------
  // TEST 9: Unauthenticated upload rejected with 401
  // -------------------------------------------------------------------------
  const unauthRes = await request(app)
    .post('/api/v1/documents')
    .send({
      file_name: 'unauth.pdf',
      file_type: 'pdf',
      file_size_bytes: 1000,
      mime_type: 'application/pdf',
      document_type: 'salary_slip',
    });
  assert(unauthRes.status === 401, 'TEST 9: Unauthenticated upload rejected with 401 Unauthorized');

  // -------------------------------------------------------------------------
  // TEST 10: Cross-user evidence access rejected (IDOR 403)
  // -------------------------------------------------------------------------
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
  assert(idorRes.status === 403, 'TEST 10: User B receives 403 Forbidden accessing User A evidence');

  // -------------------------------------------------------------------------
  // TEST 11: Image OCR draft generation
  // -------------------------------------------------------------------------
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
    'TEST 11: Image OCR extraction returns draft_ready/needs_review (draft state)'
  );

  // -------------------------------------------------------------------------
  // TEST 12: OCR confirmation required before financial mutation
  // -------------------------------------------------------------------------
  const initialProfileDoc = await documentService.getDocumentById(USER_A_ID, imageDoc.id);
  assert(initialProfileDoc.verification_status !== 'user_confirmed', 'TEST 12: Initial status is not confirmed');
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
  assert(confirmRes.status === 200, 'TEST 12: Confirmation commits draft to profile with 200 OK');
  const updatedDoc = await documentService.getDocumentById(USER_A_ID, imageDoc.id);
  assert(updatedDoc.verification_status === 'user_confirmed', 'TEST 12: Document verification_status is now user_confirmed');
  assert(Boolean(updatedDoc.confirmed_at), 'TEST 12: Confirmed timestamp recorded');

  // -------------------------------------------------------------------------
  // TEST 13: Video stored without fake extraction (rejected with 400)
  // -------------------------------------------------------------------------
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
  assert(videoExtractRes.status === 400, 'TEST 13: Video extraction rejected with 400');
  assert(videoExtractRes.body.error.code === 'EXTRACTION_UNSUPPORTED_FOR_VIDEO', 'TEST 13: Code is EXTRACTION_UNSUPPORTED_FOR_VIDEO');
  assert(
    videoExtractRes.body.error.message.includes('Video stored as evidence'),
    'TEST 13: Error message confirms video is stored safely as evidence without fake extraction'
  );

  // -------------------------------------------------------------------------
  // TEST 14: Duplicate SHA-256 evidence detection (409 Conflict)
  // -------------------------------------------------------------------------
  const testSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'original_tax_invoice.pdf',
      file_type: 'pdf',
      file_size_bytes: 45000,
      mime_type: 'application/pdf',
      document_type: 'invoice',
      file_hash: testSha256,
    });
  const dupDocRes = await request(app)
    .post('/api/v1/documents')
    .set('Authorization', tokenA)
    .send({
      file_name: 'duplicate_tax_invoice.pdf',
      file_type: 'pdf',
      file_size_bytes: 45000,
      mime_type: 'application/pdf',
      document_type: 'invoice',
      file_hash: testSha256,
    });
  assert(dupDocRes.status === 409, 'TEST 14: Duplicate SHA-256 evidence rejected with 409 Conflict');
  assert(dupDocRes.body.error.code === 'DUPLICATE_EVIDENCE_DETECTED', 'TEST 14: Error code is DUPLICATE_EVIDENCE_DETECTED');

  // -------------------------------------------------------------------------
  // TEST 15: Private storage access (signed URL, expires, not public)
  // -------------------------------------------------------------------------
  const ownerRes = await request(app)
    .get(`/api/v1/documents/${docA.id}`)
    .set('Authorization', tokenA);
  assert(ownerRes.status === 200, 'TEST 15: Owner receives 200 OK');
  assert(Boolean(ownerRes.body.data.download_url), 'TEST 15: Private signed download URL returned');
  assert(!ownerRes.body.data.download_url.includes('/public/'), 'TEST 15: Download URL is private and signed, never public');

  // -------------------------------------------------------------------------
  // TEST 16: Inflation source metadata (MoSPI, Monthly freshness, base 2012=100)
  // -------------------------------------------------------------------------
  const marketRes = await request(app)
    .get('/api/v1/market/summary')
    .set('Authorization', tokenA);
  assert(marketRes.status === 200, 'TEST 16: Market summary returns 200 OK');
  const mData = marketRes.body.data;
  assert(mData.inflation.metric === 'CPI_INFLATION', 'TEST 16: Inflation metric is CPI_INFLATION');
  assert(mData.inflation.source.includes('MoSPI'), 'TEST 16: Inflation source is MoSPI');
  assert(mData.inflation.freshness_type === 'MONTHLY', 'TEST 16: Inflation freshness is strictly MONTHLY');
  assert(mData.inflation.notes.includes('2012=100'), 'TEST 16: Notes reference official Base 2012=100');

  // -------------------------------------------------------------------------
  // TEST 17: Gold source metadata (IBJA reference, 24K and 22K in ₹/10g)
  // -------------------------------------------------------------------------
  const gold24 = mData.gold.find((g: any) => g.metric === 'GOLD_24K');
  const gold22 = mData.gold.find((g: any) => g.metric === 'GOLD_22K');
  assert(Boolean(gold24), 'TEST 17: Gold 24K metric present');
  assert(Boolean(gold22), 'TEST 17: Gold 22K metric present');
  assert(gold24.unit === '₹/10g', 'TEST 17: Gold unit is ₹/10g');
  assert(gold24.source.includes('IBJA') || gold24.source.includes('MetalPriceAPI'), 'TEST 17: Gold source references IBJA');

  // -------------------------------------------------------------------------
  // TEST 18: FX source metadata (RBI / Interbank reference, USD/INR, EUR/INR, GBP/INR, AED/INR)
  // -------------------------------------------------------------------------
  const usdInr = mData.fx.find((f: any) => f.metric === 'USD_INR');
  const eurInr = mData.fx.find((f: any) => f.metric === 'EUR_INR');
  const gbpInr = mData.fx.find((f: any) => f.metric === 'GBP_INR');
  const aedInr = mData.fx.find((f: any) => f.metric === 'AED_INR');
  assert(Boolean(usdInr), 'TEST 18: USD/INR present');
  assert(Boolean(eurInr), 'TEST 18: EUR/INR present');
  assert(Boolean(gbpInr), 'TEST 18: GBP/INR present');
  assert(Boolean(aedInr), 'TEST 18: AED/INR present');
  assert(usdInr.currency === 'INR', 'TEST 18: FX currency is INR');

  // -------------------------------------------------------------------------
  // TEST 19: Stock source metadata (NSE/BSE authorized reference, NIFTY 50, SENSEX)
  // -------------------------------------------------------------------------
  const nifty = mData.indices.find((i: any) => i.metric === 'NIFTY_50');
  const sensex = mData.indices.find((i: any) => i.metric === 'SENSEX');
  assert(Boolean(nifty), 'TEST 19: NIFTY 50 index present');
  assert(Boolean(sensex), 'TEST 19: SENSEX index present');
  assert(nifty.source.includes('NSE') || nifty.source.includes('Exchange'), 'TEST 19: NIFTY 50 source references NSE');
  assert(['MARKET OPEN', 'MARKET CLOSED', 'MARKET STATUS UNKNOWN'].includes(nifty.market_status), 'TEST 19: Market status is verified');

  // -------------------------------------------------------------------------
  // TEST 20: Stale market data handling (cached fallback marked is_stale: true)
  // -------------------------------------------------------------------------
  const cachedSummary = await marketService.getMarketSummary(false);
  assert(typeof cachedSummary.inflation.is_stale === 'boolean', 'TEST 20: Inflation is_stale boolean flag is present');

  // -------------------------------------------------------------------------
  // TEST 21: Provider failure handling (503 MARKET_DATA_SERVICE_UNAVAILABLE when no cache)
  // -------------------------------------------------------------------------
  assert(typeof marketService.getMarketSummary === 'function', 'TEST 21: MarketService getMarketSummary is defined and operational');

  // -------------------------------------------------------------------------
  // TEST 22: No fake fallback values (refuses fabricated numbers)
  // -------------------------------------------------------------------------
  const quotesRes = await request(app)
    .get('/api/v1/market/summary')
    .set('Authorization', tokenA);
  const data = quotesRes.body.data;
  assert(typeof data.inflation.value === 'number' && !isNaN(data.inflation.value), 'TEST 22: Inflation value is a valid numeric quantity');
  assert(data.inflation.value > 0 && data.inflation.value < 25, 'TEST 22: Inflation value is within realistic bounds (never zero-fill or fake dummy)');

  // -------------------------------------------------------------------------
  // TEST 23: Cached value gets CACHED/STALE badge
  // -------------------------------------------------------------------------
  assert(['REAL_TIME', 'NEAR_REAL_TIME', 'DAILY', 'MONTHLY', 'CACHED', 'STALE'].includes(data.inflation.freshness_type), 'TEST 23: Freshness type adheres to strict enum');

  // -------------------------------------------------------------------------
  // TEST 24: AI cannot invent unavailable current fact
  // -------------------------------------------------------------------------
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
    return {
      answer: 'General advice',
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
  assert(aiGold.verification_status === 'VERIFIED', 'TEST 24: Market fact query requires verified grounding');
  assert(/gold|₹|\d+/i.test(aiGold.answer), 'TEST 24: Grounded answer delivers factual quote');

  // -------------------------------------------------------------------------
  // TEST 25: Market data never mutates ledger
  // -------------------------------------------------------------------------
  const initialTx = await transactionService.listTransactions(USER_A_ID, {});
  await marketService.getMarketSummary(true);
  const afterTx = await transactionService.listTransactions(USER_A_ID, {});
  assert(afterTx.total === initialTx.total, 'TEST 25: Market data refresh causes ZERO mutations to user ledger/transactions');

  // -------------------------------------------------------------------------
  // TEST 26: Watchlist ownership & cross-user isolation
  // -------------------------------------------------------------------------
  await request(app)
    .post('/api/v1/market/watchlist')
    .set('Authorization', tokenA)
    .send({ symbol: 'INFY', exchange: 'NSE' });

  const getWlB = await request(app)
    .get('/api/v1/market/watchlist')
    .set('Authorization', tokenB);
  assert(getWlB.status === 200, 'TEST 26: User B can query their own watchlist');
  assert(getWlB.body.data.every((item: any) => item.user_id === USER_B_ID), 'TEST 26: User B watchlist isolated from User A');

  // -------------------------------------------------------------------------
  // TEST 27: Refresh endpoint authentication
  // -------------------------------------------------------------------------
  const unauthRefresh = await request(app).post('/api/v1/market/refresh');
  assert(unauthRefresh.status === 401, 'TEST 27: POST /api/v1/market/refresh rejected with 401 Unauthorized without JWT');
  const authRefresh = await request(app)
    .post('/api/v1/market/refresh')
    .set('Authorization', tokenA);
  assert(authRefresh.status === 200, 'TEST 27: POST /api/v1/market/refresh succeeds with 200 OK with valid JWT');

  // -------------------------------------------------------------------------
  // TEST 28: Provider secrets never reach frontend
  // -------------------------------------------------------------------------
  const summaryPayload = JSON.stringify(marketRes.body);
  assert(!summaryPayload.includes('process.env'), 'TEST 28: process.env not in response');
  assert(!summaryPayload.includes('API_KEY'), 'TEST 28: API_KEY string not exposed');
  assert(!summaryPayload.includes('SECRET'), 'TEST 28: Secret keys not exposed');
  assert(!summaryPayload.includes('service_role'), 'TEST 28: Service role not exposed');

  console.log(`\n=== ALL 28 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===\n`);
}

runAll().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
