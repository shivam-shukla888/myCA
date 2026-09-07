'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthRequiredState } from '../../components/auth/AuthRequiredState';
import {
  documentApi,
  ocrApi,
  marketApi,
  DocumentItem,
  ExtractionResult,
  MarketSummaryResponse,
  WatchlistItem,
} from '../../lib/api';
import {
  Upload,
  FileText,
  Camera,
  Video,
  Image as ImageIcon,
  ShieldCheck,
  Clock,
  AlertCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  X,
  XCircle,
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ReviewTransaction {
  date?: string;
  description?: string;
  type?: string;
  direction?: 'credit' | 'debit' | string;
  amount?: number;
  category?: string;
  duplicate_warning?: boolean;
  is_tax_relevant?: boolean;
}

interface DocumentReviewData {
  transactions?: ReviewTransaction[];
  employer?: string;
  salary_period?: string;
  net_income?: number;
  gross_income?: number;
  employer_name?: string;
  tax_deductions?: number;
  [key: string]: unknown;
}

export default function VaultPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'VERIFIED'>('ALL');

  // Multi-Media Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [docType, setDocType] = useState('salary_slip');
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Hidden File Inputs
  const docInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Active Media Player Modal
  const [previewMediaDoc, setPreviewMediaDoc] = useState<DocumentItem | null>(null);

  // OCR Review Drawer / Modal
  const [activeReviewDoc, setActiveReviewDoc] = useState<DocumentItem | null>(null);
  const [draftResult, setDraftResult] = useState<ExtractionResult | null>(null);
  const [reviewData, setReviewData] = useState<DocumentReviewData>({});
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live Market Intelligence State
  const [marketSummary, setMarketSummary] = useState<MarketSummaryResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  // Load documents
  async function loadDocuments() {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await documentApi.list({ limit: 50 });
      setDocuments(res.documents || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to document vault.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Load Market Intelligence
  async function loadMarketData(forceRefresh = false) {
    if (!isAuthenticated) return;
    if (forceRefresh) setMarketRefreshing(true);
    else setMarketLoading(true);

    try {
      const [summary, userWatchlist] = await Promise.all([
        marketApi.getSummary(forceRefresh),
        marketApi.getWatchlist(),
      ]);
      setMarketSummary(summary);
      setWatchlist(userWatchlist || []);
    } catch (err) {
      console.warn('[VaultPage] Failed to load market intelligence:', err);
    } finally {
      setMarketLoading(false);
      setMarketRefreshing(false);
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadDocuments();
    loadMarketData();
  }, [authLoading, isAuthenticated]);

  // Handle file selection from file input
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validate size limit (50MB for video, 10MB for documents/images)
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds ${isVideo ? '50MB' : '10MB'} limit`
      );
      return;
    }

    setSelectedFile(file);
    if (!evidenceTitle) {
      setEvidenceTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }

    // Auto-detect docType from name if matching keywords
    const lower = file.name.toLowerCase();
    if (lower.includes('salary') || lower.includes('payslip')) setDocType('salary_slip');
    else if (lower.includes('bank') || lower.includes('statement')) setDocType('bank_statement');
    else if (lower.includes('invoice') || lower.includes('bill')) setDocType('invoice');
    else if (lower.includes('receipt')) setDocType('receipt');
    else if (lower.includes('form16') || lower.includes('form 16')) setDocType('form_16');
    else if (lower.includes('itr') || lower.includes('tax')) setDocType('tax_form_itr');

    // Create preview for images or videos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const objectUrl = URL.createObjectURL(file);
      setFilePreviewUrl(objectUrl);
    } else {
      setFilePreviewUrl(null);
    }
  }

  // Upload Evidence Node
  async function handleEvidenceUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress('Authorizing secure storage node...');
    setUploadError(null);

    try {
      const isVideo = selectedFile.type.startsWith('video/');
      const isImage = selectedFile.type.startsWith('image/');
      const sourceType = isVideo ? 'VIDEO' : isImage ? 'IMAGE' : 'DOCUMENT';

      // 1. Create document metadata and get signed upload URL
      const docRecord = await documentApi.create({
        file_name: selectedFile.name,
        file_type: selectedFile.name.split('.').pop() || 'bin',
        file_size_bytes: selectedFile.size,
        mime_type: selectedFile.type || 'application/octet-stream',
        document_type: docType,
        source_type: sourceType,
        title: evidenceTitle || selectedFile.name,
        financial_year: financialYear,
      });

      // 2. Upload binary to Supabase Storage signed upload URL
      if (docRecord.upload_url) {
        setUploadProgress('Encrypting and storing binary payload in Supabase...');
        await documentApi.uploadBinary(docRecord.upload_url, selectedFile, selectedFile.type);
      }

      setUploadProgress('Evidence node established successfully!');
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setEvidenceTitle('');
      setShowUpload(false);
      await loadDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evidence upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  // Handle Delete
  async function handleDeleteDocument(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this evidence item?')) return;
    try {
      await documentApi.delete(docId);
      await loadDocuments();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Open OCR Review Drawer
  async function handleOpenReview(doc: DocumentItem) {
    setActiveReviewDoc(doc);
    setReviewError(null);
    setReviewSuccess(null);
    setExtracting(true);

    try {
      let draft: ExtractionResult;
      try {
        draft = await ocrApi.getDraft(doc.id);
      } catch {
        draft = await ocrApi.extract(doc.id);
      }
      setDraftResult(draft);
      setReviewData(JSON.parse(JSON.stringify(draft.extracted_data || {})));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract document draft';
      setReviewError(msg);
    } finally {
      setExtracting(false);
    }
  }

  // Confirm OCR Import
  async function handleConfirmImport(target: 'transactions' | 'profile' | 'archive_only') {
    if (!activeReviewDoc || !draftResult) return;
    setConfirming(true);
    setReviewError(null);
    try {
      const result = await ocrApi.confirm({
        document_id: activeReviewDoc.id,
        reviewed_data: reviewData as Record<string, unknown>,
        import_target: target,
      });

      setReviewSuccess(
        `Successfully confirmed and imported! ${result.imported_count} financial record(s) linked.`
      );
      await loadDocuments();
      const updatedDraft = await ocrApi.getDraft(activeReviewDoc.id);
      setDraftResult(updatedDraft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      setReviewError(msg);
    } finally {
      setConfirming(false);
    }
  }

  // Reject OCR Draft
  async function handleReject() {
    if (!activeReviewDoc) return;
    setRejecting(true);
    setReviewError(null);
    try {
      await ocrApi.reject({ document_id: activeReviewDoc.id });
      setReviewSuccess('Document draft rejected. Zero ledger changes made.');
      await loadDocuments();
      const updatedDraft = await ocrApi.getDraft(activeReviewDoc.id);
      setDraftResult(updatedDraft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject document';
      setReviewError(msg);
    } finally {
      setRejecting(false);
    }
  }

  // Add to Watchlist
  async function handleAddWatchlist(e: React.FormEvent) {
    e.preventDefault();
    if (!newSymbol) return;
    setAddingSymbol(true);
    setWatchlistError(null);
    try {
      const item = await marketApi.addWatchlistSymbol({ symbol: newSymbol });
      setWatchlist([...watchlist, item]);
      setNewSymbol('');
    } catch (err: unknown) {
      setWatchlistError(err instanceof Error ? err.message : 'Failed to add symbol');
    } finally {
      setAddingSymbol(false);
    }
  }

  // Remove from Watchlist
  async function handleRemoveWatchlist(symbol: string) {
    try {
      await marketApi.removeWatchlistSymbol(symbol);
      setWatchlist(watchlist.filter((w) => w.symbol !== symbol));
    } catch (err: unknown) {
      alert(`Failed to remove: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'DOCUMENT') return doc.source_type === 'DOCUMENT' || doc.mime_type === 'application/pdf';
    if (activeFilter === 'IMAGE') return doc.source_type === 'IMAGE' || doc.mime_type.startsWith('image/');
    if (activeFilter === 'VIDEO') return doc.source_type === 'VIDEO' || doc.mime_type.startsWith('video/');
    if (activeFilter === 'VERIFIED') return doc.verification_status === 'user_confirmed';
    return true;
  });

  if (authLoading) {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        Verifying secure workspace session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthRequiredState
        modeTag="EVIDENCE VAULT • SECURE ARCHIVE"
        title="Sign in to access your financial evidence vault"
        description="Encrypted multi-media evidence storage for tax proofs, bank statements, receipts, and video records."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hidden File Inputs for Explicit Media Choices */}
      <input
        type="file"
        ref={docInputRef}
        accept=".pdf,.csv"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={photoInputRef}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/mp4,video/quicktime,video/webm"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            Evidence Vault & Financial Intelligence • FY 2025–26
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Evidence Archive & Financial Intelligence
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px', maxWidth: '780px' }}>
            Multi-media financial evidence archive (PDFs, receipts, photos, video verification) with draft-first Groq OCR, coupled with verified macroeconomic and live Indian market context.
          </p>
        </div>

        {isAuthenticated && (
          <button onClick={() => setShowUpload(!showUpload)} className="instrument-btn" style={{ height: '40px' }}>
            <Upload size={14} />
            {showUpload ? 'Close Upload Desk' : 'Deposit Evidence Node'}
          </button>
        )}
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Authentication Initializing State */}
      {authLoading && (
        <div style={{
          border: '1px solid var(--border-hairline)',
          background: 'var(--canvas-surface)',
          padding: '32px',
          textAlign: 'center',
          color: 'var(--ink-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px'
        }}>
          Reconciling workspace authentication state...
        </div>
      )}

      {/* Unauthenticated Guest State */}
      {!authLoading && !isAuthenticated && (
        <AuthRequiredState
          modeTag="EVIDENCE VAULT • FY 2025–26"
          title="Sign In to Access Evidence Archive & Market Intelligence"
          description="Stored documents, photos, and video evidence are encrypted with private signed storage URLs. Sign in to your verified workspace to deposit evidence and view live market context."
        />
      )}

      {/* Authenticated Content */}
      {!authLoading && isAuthenticated && (
        <>
          {/* ========================================================================= */}
          {/* SECTION 1: EVIDENCE UPLOAD DESK */}
          {/* ========================================================================= */}
          {showUpload && (
            <div style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              padding: '24px',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="meta-tag">Evidence Ingestion Pipeline</div>
                  <h3 style={{ fontSize: '18px', marginTop: '2px' }}>Deposit Financial Evidence</h3>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Accepted: PDF • JPG • PNG • WEBP • MP4 • MOV • WEBM
                </div>
              </div>

              {/* Upload Media Source Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="instrument-btn"
                  style={{ background: 'transparent' }}
                >
                  <FileText size={14} />
                  Upload Documents (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="instrument-btn"
                  style={{ background: 'transparent' }}
                >
                  <ImageIcon size={14} />
                  Upload Photos
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="instrument-btn"
                  style={{ background: 'transparent' }}
                >
                  <Camera size={14} />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="instrument-btn"
                  style={{ background: 'transparent' }}
                >
                  <Video size={14} />
                  Upload Video Evidence
                </button>
              </div>

              {/* Drop / Selection Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const mockEvent = {
                      target: { files: e.dataTransfer.files },
                    } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileSelect(mockEvent);
                  }
                }}
                style={{
                  border: '2px dashed var(--border-hairline)',
                  borderRadius: '6px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'var(--canvas-inset)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (!selectedFile) photoInputRef.current?.click();
                }}
              >
                {!selectedFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Upload size={28} style={{ color: 'var(--ink-secondary)' }} />
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>
                      Drag & Drop files here, or click to browse
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
                      Max limits: 10MB per document/photo • 50MB per video evidence file
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    {/* Media Preview */}
                    {filePreviewUrl && selectedFile.type.startsWith('image/') && (
                      <img
                        src={filePreviewUrl}
                        alt="Preview"
                        style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '4px', border: '1px solid var(--border-hairline)' }}
                      />
                    )}
                    {filePreviewUrl && selectedFile.type.startsWith('video/') && (
                      <video
                        src={filePreviewUrl}
                        controls
                        style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '4px', border: '1px solid var(--border-hairline)' }}
                      />
                    )}
                    {!filePreviewUrl && (
                      <FileText size={36} style={{ color: '#6366f1' }} />
                    )}

                    <div>
                      <strong>{selectedFile.name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginLeft: '8px' }}>
                        ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Document'})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                      }}
                      className="instrument-btn"
                      style={{ fontSize: '11px', padding: '4px 8px', background: 'transparent', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                      <X size={12} /> Remove File
                    </button>
                  </div>
                )}
              </div>

              {/* Upload Configuration Form */}
              {selectedFile && (
                <form onSubmit={handleEvidenceUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                        Evidence Title / Description
                      </label>
                      <input
                        type="text"
                        value={evidenceTitle}
                        onChange={(e) => setEvidenceTitle(e.target.value)}
                        placeholder="e.g. September Salary Slip / Tax Deductions"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'transparent',
                          border: '1px solid var(--border-hairline)',
                          color: 'var(--ink-primary)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                        Document Classification
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'var(--canvas-surface)',
                          border: '1px solid var(--border-hairline)',
                          color: 'var(--ink-primary)',
                        }}
                      >
                        <option value="salary_slip">Salary Slip / Payslip</option>
                        <option value="bank_statement">Bank Account Statement</option>
                        <option value="invoice">Vendor Invoice</option>
                        <option value="receipt">Payment Receipt</option>
                        <option value="form_16">Form 16 / TDS Certificate</option>
                        <option value="form_26as">Form 26AS Statement</option>
                        <option value="tax_form_itr">ITR Acknowledgement</option>
                        <option value="gst_return">GST Return Filing</option>
                        <option value="other">Other Evidence / Media</option>
                      </select>
                    </div>

                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                        Financial Year
                      </label>
                      <select
                        value={financialYear}
                        onChange={(e) => setFinancialYear(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'var(--canvas-surface)',
                          border: '1px solid var(--border-hairline)',
                          color: 'var(--ink-primary)',
                        }}
                      >
                        <option value="2025-26">FY 2025–26 (Current)</option>
                        <option value="2024-25">FY 2024–25</option>
                      </select>
                    </div>
                  </div>

                  {/* Video Notice if video is selected */}
                  {selectedFile.type.startsWith('video/') && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      fontSize: '12px',
                      color: 'var(--ink-primary)',
                      borderRadius: '4px',
                    }}>
                      <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', color: '#6366f1' }} />
                      <strong>Video Storage Guarantee:</strong> Video stored as evidence. Automated financial extraction is not currently available for this video. Your video will be stored securely with zero unauthorized LLM ingestion.
                    </div>
                  )}

                  {uploadError && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#dc2626', fontSize: '12px' }}>
                      <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                      {uploadError}
                    </div>
                  )}

                  {uploadProgress && (
                    <div style={{ padding: '10px 14px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                      {uploadProgress}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                        setShowUpload(false);
                      }}
                      className="instrument-btn"
                      style={{ background: 'transparent' }}
                      disabled={uploading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploading}
                      className="instrument-btn"
                      style={{ background: '#6366f1', color: '#fff', borderColor: '#6366f1' }}
                    >
                      {uploading ? 'Storing...' : 'Deposit Evidence Node'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: YOUR EVIDENCE (ARCHIVE) */}
          {/* ========================================================================= */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px' }}>Your Evidence Repository</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                  {filteredDocuments.length} registered item(s) • Cryptographically signed private storage
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--canvas-inset)', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-hairline)' }}>
                {(['ALL', 'DOCUMENT', 'IMAGE', 'VIDEO', 'VERIFIED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    style={{
                      background: activeFilter === filter ? 'var(--canvas-surface)' : 'transparent',
                      border: activeFilter === filter ? '1px solid var(--border-hairline)' : 'none',
                      color: activeFilter === filter ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                      padding: '4px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      borderRadius: '3px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)', border: '1px solid var(--border-hairline)' }}>
                Loading evidence registry...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--ink-secondary)', border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
                <FileText size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <div style={{ fontSize: '14px', fontWeight: 500 }}>No evidence found for this filter</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Deposit salary slips, receipts, photos, or video recordings using the button above.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredDocuments.map((doc) => {
                  const isVideo = doc.source_type === 'VIDEO' || doc.mime_type.startsWith('video/');
                  const isImage = doc.source_type === 'IMAGE' || doc.mime_type.startsWith('image/');
                  const isConfirmed = doc.verification_status === 'user_confirmed';

                  return (
                    <div
                      key={doc.id}
                      style={{
                        background: 'var(--canvas-surface)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: '6px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: isVideo ? 'rgba(168, 85, 247, 0.15)' : isImage ? 'rgba(59, 130, 246, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            color: isVideo ? '#a855f7' : isImage ? '#3b82f6' : '#6366f1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            {isVideo ? <Video size={10} /> : isImage ? <ImageIcon size={10} /> : <FileText size={10} />}
                            {doc.source_type || (isVideo ? 'VIDEO' : isImage ? 'IMAGE' : 'DOCUMENT')}
                          </span>

                          <span className={`badge-signal ${isConfirmed ? 'badge-forest' : isVideo ? 'badge-amber' : 'badge-amber'}`}>
                            {isConfirmed ? 'VERIFIED' : isVideo ? 'EVIDENCE ONLY' : doc.extraction_status.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '14px', wordBreak: 'break-word' }}>
                          {doc.title || doc.file_name}
                        </div>
                        {doc.title && (
                          <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
                            {doc.file_name}
                          </div>
                        )}

                        <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>Size: {(doc.file_size_bytes / 1024).toFixed(1)} KB</span>
                          <span>FY: {doc.financial_year || '2025-26'}</span>
                          <span>{new Date(doc.uploaded_at).toLocaleDateString('en-IN')}</span>
                        </div>

                        {/* Video notice */}
                        {isVideo && (
                          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--ink-secondary)', fontStyle: 'italic', background: 'var(--canvas-inset)', padding: '6px 8px', borderRadius: '4px' }}>
                            Video stored as evidence. Automated financial extraction is not currently available for this video.
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* Play / View Button for Videos and Images */}
                          {(isVideo || isImage) && (
                            <button
                              type="button"
                              onClick={() => setPreviewMediaDoc(doc)}
                              className="instrument-btn"
                              style={{ fontSize: '11px', padding: '4px 8px', background: 'transparent' }}
                            >
                              <Eye size={12} /> View Media
                            </button>
                          )}

                          {/* Review OCR Draft for Documents & Images */}
                          {!isVideo && (
                            <button
                              type="button"
                              onClick={() => handleOpenReview(doc)}
                              className="instrument-btn"
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                            >
                              <FileText size={12} />
                              {isConfirmed ? 'View Draft' : 'Review Draft'}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteDocument(doc.id, e)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', padding: '4px' }}
                          title="Delete evidence"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="hairline-rule" style={{ margin: '8px 0' }} />

          {/* ========================================================================= */}
          {/* SECTION 3: LIVE FINANCIAL INTELLIGENCE */}
          {/* ========================================================================= */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div className="meta-tag" style={{ color: '#16a34a' }}>Macroeconomic & Indian Market Context</div>
                <h2 style={{ fontSize: '20px', marginTop: '2px' }}>Live Financial Intelligence</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {marketSummary && (
                  <span style={{ fontSize: '11px', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                    Last updated {new Date(marketSummary.last_updated).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => loadMarketData(true)}
                  disabled={marketRefreshing}
                  className="instrument-btn"
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent' }}
                >
                  <RefreshCw size={12} style={{ animation: marketRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                  {marketRefreshing ? 'Refreshing...' : 'Refresh Feed'}
                </button>
              </div>
            </div>

            {marketLoading && !marketSummary ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)', border: '1px solid var(--border-hairline)' }}>
                Loading verified market intelligence...
              </div>
            ) : marketSummary ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {/* 1. INDIA CPI INFLATION */}
                <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="meta-tag">Official MoSPI Data</span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                      {marketSummary.inflation.freshness_type}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>India CPI Inflation</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '6px 0' }}>
                    {marketSummary.inflation.display_value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
                    Period: <strong>{marketSummary.inflation.observed_period || 'Latest'}</strong> • Published: {new Date(marketSummary.inflation.published_at || '').toLocaleDateString('en-IN')}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink-tertiary)', marginTop: '6px' }}>
                    Source: {marketSummary.inflation.source}
                  </div>
                </div>

                {/* 2. GOLD (₹/10g) */}
                <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="meta-tag">Domestic Bullion</span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04' }}>
                      {marketSummary.gold[0]?.freshness_type || 'DAILY'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>Gold (per 10g)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: 700 }}>
                        {marketSummary.gold.find((g) => g.metric === 'GOLD_24K')?.display_value || '₹73,500'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>24K (99.9% Purity)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 600 }}>
                        {marketSummary.gold.find((g) => g.metric === 'GOLD_22K')?.display_value || '₹67,375'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>22K (Jewellery)</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink-tertiary)', marginTop: '12px' }}>
                    Source: IBJA Reference • Excludes 3% GST
                  </div>
                </div>

                {/* 3. FOREIGN EXCHANGE */}
                <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="meta-tag">Foreign Exchange</span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                      {marketSummary.fx[0]?.freshness_type || 'DAILY'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', marginBottom: '8px' }}>RBI Reference Rates</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {marketSummary.fx.slice(0, 4).map((f) => (
                      <div key={f.metric} style={{ background: 'var(--canvas-inset)', padding: '6px 8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--ink-secondary)' }}>{f.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 600 }}>{f.display_value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink-tertiary)', marginTop: '8px' }}>
                    Source: RBI Official Reference Benchmark
                  </div>
                </div>

                {/* 4. MARKET INDICES */}
                <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="meta-tag">NSE / BSE Benchmark</span>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: marketSummary.market_status === 'MARKET OPEN' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                      color: marketSummary.market_status === 'MARKET OPEN' ? '#16a34a' : '#64748b',
                    }}>
                      {marketSummary.market_status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', marginBottom: '8px' }}>Indian Stock Indices</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {marketSummary.indices.slice(0, 2).map((idx) => (
                      <div key={idx.metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{idx.label}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{idx.display_value}</span>
                          {idx.percentage_change !== null && idx.percentage_change !== undefined && (
                            <span style={{ fontSize: '11px', marginLeft: '6px', color: idx.percentage_change >= 0 ? '#16a34a' : '#dc2626' }}>
                              {idx.percentage_change >= 0 ? '+' : ''}{idx.percentage_change}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink-tertiary)', marginTop: '12px' }}>
                    Source: National Stock Exchange of India (Reference)
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: STOCK WATCHLIST */}
          {/* ========================================================================= */}
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '6px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px' }}>Personal Stock & Index Watchlist</h3>
                <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                  Track reference quotes for planning context. Personal CA does not provide stock tips or brokerage execution.
                </div>
              </div>

              {/* Add Symbol Form */}
              <form onSubmit={handleAddWatchlist} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. INFY, TCS, RELIANCE"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--canvas-inset)',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--ink-primary)',
                    borderRadius: '4px',
                    width: '180px',
                  }}
                />
                <button
                  type="submit"
                  disabled={addingSymbol || !newSymbol}
                  className="instrument-btn"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  <Plus size={12} /> {addingSymbol ? 'Adding...' : 'Add Symbol'}
                </button>
              </form>
            </div>

            {watchlistError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontSize: '12px', marginBottom: '12px' }}>
                {watchlistError}
              </div>
            )}

            {watchlist.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', textAlign: 'center', padding: '16px' }}>
                No symbols in watchlist. Add symbols like RELIANCE, TCS, or INFY above.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {watchlist.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--canvas-inset)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: '4px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                        {item.symbol}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                        {item.quote?.display_value || '₹---'}
                      </div>
                      {item.quote?.percentage_change !== null && item.quote?.percentage_change !== undefined && (
                        <div style={{ fontSize: '10px', color: item.quote.percentage_change >= 0 ? '#16a34a' : '#dc2626' }}>
                          {item.quote.percentage_change >= 0 ? '+' : ''}{item.quote.percentage_change}%
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveWatchlist(item.symbol)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)', padding: '4px' }}
                      title="Remove from watchlist"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: SOURCE & DATA FRESHNESS DRAWER */}
          {/* ========================================================================= */}
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'var(--ink-secondary)',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} color="#16a34a" /> Source & Data Freshness Disclosures (Provenance)
              </span>
              {showSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showSources && (
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-hairline)', fontSize: '11px', color: 'var(--ink-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <strong>Official MoSPI Inflation:</strong> All-India CPI Combined inflation published by the National Statistical Office (NSO), MoSPI, Base 2012=100. Released strictly on a monthly cycle. Under Personal CA integrity policy, inflation is never falsely labeled as real-time.
                </div>
                <div>
                  <strong>Bullion Pricing:</strong> Indicative reference closing prices based on India Bullion and Jewellers Association (IBJA) standards for 24K (99.9%) and 22K (91.6%) gold per 10 grams. Excludes local GST.
                </div>
                <div>
                  <strong>Foreign Exchange:</strong> Official Reserve Bank of India (RBI) Reference Rates published at 13:30 IST on trading weekdays.
                </div>
                <div>
                  <strong>Equity Quotations:</strong> Reference closing and indicative levels. Licensed market data requires configuring authorized exchange vendor keys. Market movements are isolated as contextual planning data and do NOT automatically mutate your financial accounts or net worth.
                </div>
                {marketSummary?.disclaimer && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--canvas-inset)', borderRadius: '4px', fontStyle: 'italic', borderLeft: '3px solid #eab308' }}>
                    {marketSummary.disclaimer}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MEDIA PREVIEW MODAL (IMAGE / VIDEO) */}
      {/* ========================================================================= */}
      {previewMediaDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '24px',
        }}>
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '8px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-hairline)' }}>
              <div>
                <h3 style={{ fontSize: '16px' }}>{previewMediaDoc.title || previewMediaDoc.file_name}</h3>
                <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
                  {previewMediaDoc.source_type || 'EVIDENCE'} • {previewMediaDoc.mime_type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMediaDoc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', overflow: 'auto' }}>
              {previewMediaDoc.source_type === 'VIDEO' || previewMediaDoc.mime_type.startsWith('video/') ? (
                <video
                  src={previewMediaDoc.download_url}
                  controls
                  style={{ maxHeight: '60vh', maxWidth: '100%' }}
                />
              ) : (
                <img
                  src={previewMediaDoc.download_url}
                  alt={previewMediaDoc.file_name}
                  style={{ maxHeight: '60vh', maxWidth: '100%', objectFit: 'contain' }}
                />
              )}
            </div>

            {previewMediaDoc.source_type === 'VIDEO' && (
              <div style={{ padding: '12px 16px', background: 'var(--canvas-inset)', fontSize: '12px', color: 'var(--ink-secondary)', borderTop: '1px solid var(--border-hairline)' }}>
                <strong>Evidence Archive Note:</strong> Video stored as evidence. Automated financial extraction is not currently available for this video.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OCR REVIEW DRAWER / MODAL */}
      {/* ========================================================================= */}
      {activeReviewDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '24px',
        }}>
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '8px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '24px',
            gap: '16px',
            overflowY: 'auto',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="meta-tag">Evidence Review & Verification Desk</div>
                <h2 style={{ fontSize: '20px', marginTop: '4px' }}>{activeReviewDoc.title || activeReviewDoc.file_name}</h2>
                <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                  Document Node: #{activeReviewDoc.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveReviewDoc(null);
                  setDraftResult(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Extraction Loader */}
            {extracting && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)' }}>
                <Clock size={24} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '8px' }} />
                <div>Extracting document text and building verification draft with Groq OCR...</div>
              </div>
            )}

            {/* Error / Success Notifications */}
            {reviewError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#dc2626', fontSize: '13px' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {reviewError}
              </div>
            )}

            {reviewSuccess && (
              <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', color: '#16a34a', fontSize: '13px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {reviewSuccess}
              </div>
            )}

            {/* Review Draft Content */}
            {!extracting && draftResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Status Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)' }}>
                  <div>
                    <span className="meta-tag">Document Type: </span>
                    <strong>{draftResult.document_type}</strong>
                  </div>
                  <div>
                    <span className="meta-tag">Confidence: </span>
                    <strong>{Math.round(draftResult.confidence_score * 100)}%</strong>
                  </div>
                  <div>
                    <span className={`badge-signal ${draftResult.extraction_status === 'confirmed' ? 'badge-forest' : 'badge-amber'}`}>
                      {draftResult.extraction_status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Warnings / Duplicate Alerts */}
                {draftResult.warnings && draftResult.warnings.length > 0 && (
                  <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', fontSize: '12px', color: '#b45309' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      Review Alerts ({draftResult.warnings.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {draftResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notice: AI Extraction Policy */}
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', background: 'var(--canvas-inset)', padding: '12px 16px', borderLeft: '3px solid #6366f1', borderRadius: '4px' }}>
                  <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: '2px' }}>AI extracted this from your evidence. Review it before saving.</strong>
                  <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                    Strict Safety Policy: OCR extractions are uncommitted drafts. No changes have been made to your balances or financial records. Review and edit values below before confirming, or reject to discard.
                  </span>
                </div>

                {/* Bank Statement Transactions Review */}
                {draftResult.document_type === 'BANK_STATEMENT' && reviewData.transactions && (
                  <div>
                    <div className="meta-tag" style={{ marginBottom: '8px' }}>Extracted Statement Transactions</div>
                    <div style={{ border: '1px solid var(--border-hairline)', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'var(--canvas-inset)', textAlign: 'left', borderBottom: '1px solid var(--border-hairline)' }}>
                            <th style={{ padding: '8px 12px' }}>Date</th>
                            <th style={{ padding: '8px 12px' }}>Description</th>
                            <th style={{ padding: '8px 12px' }}>Type</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (₹)</th>
                            <th style={{ padding: '8px 12px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewData.transactions.map((tx: ReviewTransaction, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="text"
                                  value={tx.date}
                                  disabled={draftResult.extraction_status === 'confirmed'}
                                  onChange={(e) => {
                                    const updated = [...(reviewData.transactions || [])];
                                    updated[idx].date = e.target.value;
                                    setReviewData({ ...reviewData, transactions: updated });
                                  }}
                                  style={{ padding: '4px 6px', width: '90px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="text"
                                  value={tx.description}
                                  disabled={draftResult.extraction_status === 'confirmed'}
                                  onChange={(e) => {
                                    const updated = [...(reviewData.transactions || [])];
                                    updated[idx].description = e.target.value;
                                    setReviewData({ ...reviewData, transactions: updated });
                                  }}
                                  style={{ padding: '4px 6px', width: '100%', minWidth: '180px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className={tx.direction === 'credit' ? 'badge-signal badge-forest' : 'badge-signal badge-amber'}>
                                  {(tx.direction || 'DEBIT').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  value={tx.amount}
                                  disabled={draftResult.extraction_status === 'confirmed'}
                                  onChange={(e) => {
                                    const updated = [...(reviewData.transactions || [])];
                                    updated[idx].amount = parseFloat(e.target.value) || 0;
                                    setReviewData({ ...reviewData, transactions: updated });
                                  }}
                                  style={{ padding: '4px 6px', width: '100px', textAlign: 'right', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {tx.duplicate_warning ? (
                                  <span style={{ color: '#b45309', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} /> Duplicate?
                                  </span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: '11px' }}>Ready</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Salary Slip Review */}
                {draftResult.document_type === 'SALARY_SLIP' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Employer</label>
                      <input
                        type="text"
                        value={reviewData.employer || ''}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, employer: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Period</label>
                      <input
                        type="text"
                        value={reviewData.salary_period || ''}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, salary_period: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Gross Salary (₹)</label>
                      <input
                        type="number"
                        value={reviewData.gross_income || 0}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, gross_income: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Net Pay (₹)</label>
                      <input
                        type="number"
                        value={reviewData.net_income || 0}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, net_income: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                  </div>
                )}

                {/* Confirmation Footer */}
                {draftResult.extraction_status === 'rejected' ? (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', fontSize: '12px', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px' }}>
                    <XCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    This document draft was rejected by the user. Zero ledger or balance mutations were made.
                  </div>
                ) : draftResult.extraction_status !== 'confirmed' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-hairline)' }}>
                    <button
                      type="button"
                      disabled={confirming || rejecting}
                      onClick={handleReject}
                      className="instrument-btn"
                      style={{ background: 'transparent', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                      <XCircle size={14} />
                      {rejecting ? 'Rejecting...' : 'Reject Draft'}
                    </button>

                    <button
                      type="button"
                      disabled={confirming || rejecting}
                      onClick={() => handleConfirmImport('archive_only')}
                      className="instrument-btn"
                      style={{ background: 'transparent' }}
                    >
                      Archive Evidence Only
                    </button>

                    <button
                      type="button"
                      disabled={confirming || rejecting}
                      onClick={() => handleConfirmImport(draftResult.document_type === 'SALARY_SLIP' ? 'profile' : 'transactions')}
                      className="instrument-btn"
                      style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}
                    >
                      <CheckCircle2 size={14} />
                      {confirming ? 'Importing...' : 'Confirm & Commit to Ledger'}
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.08)', textAlign: 'center', fontSize: '12px', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '4px' }}>
                    <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Verified & Imported into Ledger. User verified on {new Date(draftResult.confirmed_at || '').toLocaleString('en-IN')}.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
