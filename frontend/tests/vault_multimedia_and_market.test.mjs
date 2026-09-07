import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('MYCA Vault Multi-Media Evidence Archive & Live Market Intelligence Frontend Suite', () => {
  const apiPath = path.resolve('src/lib/api.ts');
  const vaultPath = path.resolve('src/app/vault/page.tsx');
  const nextConfigPath = path.resolve('next.config.ts');

  assert.ok(fs.existsSync(apiPath), 'src/lib/api.ts must exist');
  assert.ok(fs.existsSync(vaultPath), 'src/app/vault/page.tsx must exist');
  assert.ok(fs.existsSync(nextConfigPath), 'next.config.ts must exist');

  const apiSource = fs.readFileSync(apiPath, 'utf8');
  const vaultSource = fs.readFileSync(vaultPath, 'utf8');
  const nextConfigSource = fs.readFileSync(nextConfigPath, 'utf8');

  it('verifies api.ts defines multi-media DocumentItem and documentApi', () => {
    assert.ok(apiSource.includes('export interface DocumentItem'), 'Must export DocumentItem');
    assert.ok(apiSource.includes('source_type?:'), 'Must define source_type on DocumentItem');
    assert.ok(apiSource.includes('ocr_status?:'), 'Must define ocr_status on DocumentItem');
    assert.ok(apiSource.includes('verification_status?:'), 'Must define verification_status on DocumentItem');
    assert.ok(apiSource.includes('title?:'), 'Must define title on DocumentItem');
    assert.ok(apiSource.includes('download_url?:'), 'Must define download_url on DocumentItem');
    assert.ok(apiSource.includes('export const documentApi = {'), 'Must export documentApi');
    assert.ok(apiSource.includes('delete:'), 'Must provide delete in documentApi');
  });

  it('verifies api.ts defines live market types and marketApi', () => {
    assert.ok(apiSource.includes('export interface MarketMetric'), 'Must export MarketMetric');
    assert.ok(apiSource.includes('export interface MarketSummaryResponse'), 'Must export MarketSummaryResponse');
    assert.ok(apiSource.includes('export interface WatchlistItem'), 'Must export WatchlistItem');
    assert.ok(apiSource.includes('export const marketApi = {'), 'Must export marketApi');
    assert.ok(apiSource.includes('getSummary:'), 'Must provide getSummary');
    assert.ok(apiSource.includes('getWatchlist:'), 'Must provide getWatchlist');
    assert.ok(apiSource.includes('addWatchlistSymbol:'), 'Must provide addWatchlistSymbol');
    assert.ok(apiSource.includes('removeWatchlistSymbol:'), 'Must provide removeWatchlistSymbol');
  });

  it('verifies Section 1: EVIDENCE UPLOAD DESK contains all multi-media actions', () => {
    assert.ok(vaultSource.includes('Upload Documents (PDF)'), 'Must contain Upload Documents button');
    assert.ok(vaultSource.includes('Upload Photos'), 'Must contain Upload Photos button');
    assert.ok(vaultSource.includes('Take Photo'), 'Must contain Take Photo camera button');
    assert.ok(vaultSource.includes('Upload Video Evidence'), 'Must contain Upload Video Evidence button');
    assert.ok(vaultSource.includes('Accepted: PDF • JPG • PNG • WEBP • MP4 • MOV • WEBM'), 'Must display accepted formats string');
    assert.ok(vaultSource.includes('onDragOver'), 'Must support drag and drop');
    assert.ok(vaultSource.includes('onDrop'), 'Must handle file drop');
  });

  it('verifies Section 2: YOUR EVIDENCE includes 5 filter tabs and preview/review drawers', () => {
    assert.ok(vaultSource.includes("'ALL'"), 'Must support ALL filter tab');
    assert.ok(vaultSource.includes("'DOCUMENT'"), 'Must support DOCUMENT filter tab');
    assert.ok(vaultSource.includes("'IMAGE'"), 'Must support IMAGE filter tab');
    assert.ok(vaultSource.includes("'VIDEO'"), 'Must support VIDEO filter tab');
    assert.ok(vaultSource.includes("'VERIFIED'"), 'Must support VERIFIED filter tab');
    assert.ok(vaultSource.includes('previewMediaDoc'), 'Must support media preview modal');
    assert.ok(vaultSource.includes('draftResult'), 'Must support review draft drawer');
    assert.ok(vaultSource.includes('Confirm & Commit to Ledger'), 'Must have user confirmation button');
  });

  it('verifies Section 3: LIVE FINANCIAL INTELLIGENCE renders all 4 key metric cards', () => {
    assert.ok(vaultSource.includes('India CPI Inflation'), 'Must render CPI Inflation card');
    assert.ok(vaultSource.includes('Gold (per 10g)'), 'Must render Gold per 10g card');
    assert.ok(vaultSource.includes('Foreign Exchange'), 'Must render Foreign Exchange card');
    assert.ok(vaultSource.includes('Indian Stock Indices'), 'Must render Benchmark Indices card');
    assert.ok(vaultSource.includes('Refresh Feed'), 'Must have refresh button with IST time');
    assert.ok(vaultSource.includes('NIFTY_50') || vaultSource.includes('indices'), 'Must feature index metrics');
  });

  it('verifies Section 4: PERSONAL STOCK & INDEX WATCHLIST is interactive', () => {
    assert.ok(vaultSource.includes('Personal Stock & Index Watchlist'), 'Must render Personal Watchlist header');
    assert.ok(vaultSource.includes('handleAddWatchlist'), 'Must handle symbol addition');
    assert.ok(vaultSource.includes('handleRemoveWatchlist'), 'Must handle symbol removal');
    assert.ok(vaultSource.includes('watchlist.length'), 'Must check watchlist items');
  });

  it('verifies Section 5: SOURCE & DATA FRESHNESS DISCLOSURES provides full provenance', () => {
    assert.ok(vaultSource.includes('Source & Data Freshness Disclosures (Provenance)'), 'Must have provenance disclosure header');
    assert.ok(vaultSource.includes('setShowSources'), 'Must have expandable provenance toggle state');
    assert.ok(vaultSource.includes('MoSPI'), 'Must cite MoSPI');
    assert.ok(vaultSource.includes('IBJA'), 'Must cite IBJA');
    assert.ok(vaultSource.includes('RBI'), 'Must cite RBI');
    assert.ok(vaultSource.includes('STATUTORY DISCLAIMER') || vaultSource.includes('statutory') || vaultSource.includes('disclaimer'), 'Must reference statutory disclaimer');
  });

  it('verifies next.config.ts permits camera access on self for mobile capture', () => {
    assert.ok(nextConfigSource.includes('camera=(self)'), 'next.config.ts must allow camera=(self) in Permissions-Policy');
  });
});
