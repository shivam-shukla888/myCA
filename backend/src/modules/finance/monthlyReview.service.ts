import { canonicalFinanceService } from './canonicalFinance.service.js';
import { croreService } from '../crore/crore.service.js';
import { generateStructuredMonthlyReview } from './monthlyReview.engine.js';
import { StructuredMonthlyReview } from './monthlyReview.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export class MonthlyReviewService {
  /**
   * Builds the structured, deterministic monthly financial review answering the 9 essential user questions.
   */
  async getMonthlyReview(userId: string, targetMonth?: string): Promise<StructuredMonthlyReview> {
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const now = new Date();
    const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Compute previous month ISO (e.g. 2026-08 for 2026-09)
    const [yearNum, monthNum] = month.split('-').map(Number);
    const prevDate = new Date(Date.UTC(yearNum, monthNum - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

    // 1. Fetch Current and Previous Canonical States
    const [currState, prevState] = await Promise.all([
      canonicalFinanceService.getCanonicalFinancialState(userId, month),
      canonicalFinanceService.getCanonicalFinancialState(userId, prevMonth).catch(() => null),
    ]);

    // 2. Fetch Current and Previous ₹1 Crore Projections
    const [currCroreRes, prevCroreRes] = await Promise.all([
      croreService.getUserCroreStatus(userId, month).catch(() => null),
      prevState ? croreService.getUserCroreStatus(userId, prevMonth).catch(() => null) : Promise.resolve(null),
    ]);

    return generateStructuredMonthlyReview({
      currentMonth: currState,
      previousMonth: prevState,
      currentCrore: currCroreRes?.calculation || null,
      previousCrore: prevCroreRes?.calculation || null,
    });
  }
}

export const monthlyReviewService = new MonthlyReviewService();
