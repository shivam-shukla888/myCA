import { canonicalFinanceService } from './canonicalFinance.service.js';
import { croreService } from '../crore/crore.service.js';
import { detectDeterministicChanges } from './changeDetection.engine.js';
import { ChangeDetectionResult } from './changeDetection.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ChangeDetectionService {
  /**
   * Deterministically identifies the top 3 most material changes between current and previous valid period.
   * If insufficient history exists, explicitly returns an insufficient-history state.
   */
  async detectChanges(
    userId: string,
    targetMonth?: string,
    previousMonthOverride?: string
  ): Promise<ChangeDetectionResult> {
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const now = new Date();
    const currentMonthIso = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let prevMonthIso = previousMonthOverride;
    if (!prevMonthIso) {
      const [yearNum, monthNum] = currentMonthIso.split('-').map(Number);
      const prevDate = new Date(Date.UTC(yearNum, monthNum - 2, 1));
      prevMonthIso = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    // 1. Concurrently retrieve current and previous canonical financial states
    const [currState, prevState] = await Promise.all([
      canonicalFinanceService.getCanonicalFinancialState(userId, currentMonthIso),
      canonicalFinanceService.getCanonicalFinancialState(userId, prevMonthIso).catch(() => null),
    ]);

    // 2. Concurrently retrieve ₹1 Crore projections
    const [currCrore, prevCrore] = await Promise.all([
      croreService.getUserCroreStatus(userId, currentMonthIso).catch(() => null),
      prevState ? croreService.getUserCroreStatus(userId, prevMonthIso).catch(() => null) : Promise.resolve(null),
    ]);

    // 3. Execute pure deterministic change detection
    return detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
      currentCrore: currCrore?.calculation || null,
      previousCrore: prevCrore?.calculation || null,
    });
  }
}

export const changeDetectionService = new ChangeDetectionService();
