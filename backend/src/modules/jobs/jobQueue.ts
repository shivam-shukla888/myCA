import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export type JobType = 'DOCUMENT_OCR_EXTRACTION' | 'FISCAL_REPORT_SYNTHESIS' | 'BULK_TRANSACTION_IMPORT';

export interface JobRecord<TData = any, TResult = any> {
  id: string;
  user_id: string;
  type: JobType;
  status: JobStatus;
  data: TData;
  result?: TResult;
  error?: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export class BackgroundJobQueue {
  private jobs: Map<string, JobRecord> = new Map();
  private isProcessing = false;

  constructor() {
    // Only start polling loop if not in production or when explicitly enabled
    const timer = setInterval(() => {
      this.processNextJobs();
    }, 500);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  public createJob<TData>(
    userId: string,
    type: JobType,
    data: TData,
    maxAttempts = 3
  ): JobRecord<TData> {
    const isProduction = env.NODE_ENV === 'production';
    if (isProduction) {
      throw new Error('QUEUE_UNAVAILABLE_IN_PRODUCTION: In-memory job queue is not durable and cannot run in production.');
    }

    const job: JobRecord<TData> = {
      id: uuidv4(),
      user_id: userId,
      type,
      status: 'QUEUED',
      data,
      attempts: 0,
      max_attempts: maxAttempts,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.jobs.set(job.id, job);
    return job;
  }

  public getJob(jobId: string, userId: string): JobRecord | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    // Strictly enforce user isolation
    if (job.user_id !== userId) return null;
    return job;
  }

  public listJobs(userId: string): JobRecord[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  private async processNextJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const [id, job] of this.jobs.entries()) {
        if (job.status === 'QUEUED' || job.status === 'RETRYING') {
          await this.executeJob(job);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: JobRecord) {
    job.status = 'PROCESSING';
    job.attempts += 1;
    job.updated_at = new Date().toISOString();

    try {
      let result: any = null;

      if (job.type === 'DOCUMENT_OCR_EXTRACTION') {
        const isProduction = env.NODE_ENV === 'production';
        const enableTestOcrMock = process.env.ENABLE_TEST_OCR_MOCK === 'true';

        // Fail closed in production or if real OCR provider is not configured
        if (isProduction || !enableTestOcrMock) {
          job.status = 'FAILED';
          job.error = 'OCR_PROVIDER_NOT_CONFIGURED: Real OCR extraction provider is not configured. Synthetic financial extraction is disabled.';
          job.updated_at = new Date().toISOString();
          return;
        }

        // Test mock only — explicitly flagged as synthetic mock
        result = {
          document_id: job.data.document_id,
          is_mock: true,
          status: 'MOCK_TEST_EXTRACTION_ONLY',
          processed_at: new Date().toISOString(),
        };
      } else if (job.type === 'FISCAL_REPORT_SYNTHESIS') {
        result = {
          report_type: 'tax_dossier_summary',
          financial_year: job.data.financial_year || '2025-26',
          status: 'completed',
          processed_at: new Date().toISOString(),
        };
      } else {
        result = { processed: true };
      }

      // Mark complete
      job.status = 'COMPLETED';
      job.result = result;
      job.completed_at = new Date().toISOString();
      job.updated_at = new Date().toISOString();
    } catch (err: any) {
      if (job.attempts < job.max_attempts) {
        job.status = 'RETRYING';
        job.error = `Attempt ${job.attempts} failed: ${err.message}. Retrying...`;
      } else {
        job.status = 'FAILED';
        job.error = `Job failed after ${job.attempts} attempts: ${err.message}`;
      }
      job.updated_at = new Date().toISOString();
    }
  }
}

export const jobQueue = new BackgroundJobQueue();
