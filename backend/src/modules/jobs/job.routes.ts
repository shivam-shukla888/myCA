import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { jobQueue } from './jobQueue.js';
import { env } from '../../config/env.js';

const router = Router();

// Production guard: in-memory queue is not durable and strictly disabled in production
router.use((req: Request, res: Response, next) => {
  if (env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: {
        code: 'QUEUE_UNAVAILABLE_IN_PRODUCTION',
        message: 'Durable distributed background job queue is not configured for production environment.',
      },
    });
  }
  next();
});

router.use(requireAuth);

// Create asynchronous job
router.post('/create', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { type, data } = req.body;

  if (!type) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required field: type',
      },
    });
  }

  try {
    const job = jobQueue.createJob(userId, type, data || {});
    return res.status(202).json({
      data: {
        job_id: job.id,
        status: job.status,
        type: job.type,
        created_at: job.created_at,
        message: 'Job submitted for asynchronous background processing.',
      },
    });
  } catch (err: any) {
    return res.status(503).json({
      error: {
        code: 'QUEUE_ERROR',
        message: err.message,
      },
    });
  }
});

// Retrieve job status & results
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const jobId = req.params.id;

  const job = jobQueue.getJob(jobId, userId);
  if (!job) {
    return res.status(404).json({
      error: {
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} not found or access denied.`,
      },
    });
  }

  return res.status(200).json({
    data: job,
  });
});

// List user jobs
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const jobs = jobQueue.listJobs(userId);

  return res.status(200).json({
    data: {
      jobs,
      total: jobs.length,
    },
  });
});

export default router;
