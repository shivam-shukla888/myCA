// StateWrapper.tsx - reusable UI state handling component

import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * UI State codes shared with backend orchestrator.
 * Must stay in sync with backend/src/util/stateCodes.ts
 */
export enum StateCode {
  LOADING = 'LOADING',
  EMPTY = 'EMPTY',
  UNKNOWN = 'UNKNOWN',
  PARTIAL = 'PARTIAL',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  AI_FAILURE = 'AI_FAILURE',
  OCR_FAILURE = 'OCR_FAILURE',
  DATABASE_FAILURE = 'DATABASE_FAILURE',
  INSUFFICIENT_EVIDENCE = 'INSUFFICIENT_EVIDENCE',
}

interface StateWrapperProps {
  /** State code returned from backend orchestration */
  stateCode: StateCode;
  /** Optional error object for detailed technical messages (not shown to user) */
  error?: unknown;
  /** Callback to retry an operation – used for NETWORK_FAILURE etc. */
  onRetry?: () => void;
  /** Content to render when the state is SUCCESS */
  children: React.ReactNode;
  /** Optional fallback UI for EMPTY/UNKNOWN/PARTIAL states */
  fallback?: React.ReactNode;
}

/**
 * Renders UI based on the supplied {@link StateCode}. Each branch follows the
 * product guidelines: human‑readable messages, no silent failures, and retains
 * technical details for debugging (accessible via console). The component is
 * deliberately visual‑rich: subtle animations, micro‑copy, and consistent colour
 * tokens.
 */
export const StateWrapper: React.FC<StateWrapperProps> = ({
  stateCode,
  error,
  onRetry,
  children,
  fallback,
}) => {
  switch (stateCode) {
    case StateCode.LOADING:
      return (
        <div role="status" aria-live="polite" style={{ padding: '24px', textAlign: 'center' }}>
          <RefreshCw size={24} className="spin" style={{ color: 'var(--signal-amber)' }} aria-hidden="true" />
          <div style={{ marginTop: '8px', color: 'var(--ink-secondary)', fontSize: '13px' }}>
            Loading…
          </div>
        </div>
      );

    case StateCode.EMPTY:
      return (
        <div role="status" aria-live="polite" style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
          <p>No data available yet.</p>
          {fallback}
        </div>
      );

    case StateCode.UNKNOWN:
      return (
        <div role="status" aria-live="polite" style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
          <p>We could not determine a result.</p>
          {fallback}
        </div>
      );

    case StateCode.PARTIAL:
      return (
        <div role="region" aria-label="Partial data warning" style={{ padding: '24px', border: '1px solid var(--signal-amber)', background: 'var(--canvas-inset)' }}>
          <p style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>Partial data loaded.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>
            Some sections could not be validated. Review the highlighted items.
          </p>
          {children}
        </div>
      );

    case StateCode.SUCCESS:
      return <>{children}</>;

    case StateCode.ERROR:
      console.error('StateWrapper error:', error);
      return (
        <div role="alert" aria-live="assertive" style={{ padding: '24px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>Something went wrong.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
        </div>
      );

    case StateCode.UNAUTHORIZED:
      return (
        <div role="alert" style={{ padding: '24px', background: 'var(--canvas-surface)', borderLeft: '4px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>Authentication required.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>Please sign in to continue.</p>
        </div>
      );

    case StateCode.SESSION_EXPIRED:
      return (
        <div role="alert" style={{ padding: '24px', background: 'var(--canvas-surface)', borderLeft: '4px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>Session expired.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>Refresh the page and sign in again.</p>
        </div>
      );

    case StateCode.NETWORK_FAILURE:
      return (
        <div role="alert" aria-live="assertive" style={{ padding: '24px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>Network issue.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>Check your connection and try again.</p>
          {onRetry && (
            <button type="button" onClick={onRetry} aria-label="Retry failed network request" className="instrument-btn" style={{ marginTop: '8px', minHeight: '44px' }}>
              Retry
            </button>
          )}
        </div>
      );

    case StateCode.AI_FAILURE:
      return (
        <div role="alert" style={{ padding: '24px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>AI processing error.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>The assistant could not generate a response.</p>
        </div>
      );

    case StateCode.OCR_FAILURE:
      return (
        <div role="alert" style={{ padding: '24px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>Document scan failed.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>Please re‑upload a clearer image.</p>
        </div>
      );

    case StateCode.DATABASE_FAILURE:
      return (
        <div role="alert" style={{ padding: '24px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-terracotta)' }}>
          <p style={{ color: 'var(--signal-terracotta)', fontWeight: 600 }}>Data storage error.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>Our servers couldn’t save your data. Try again later.</p>
        </div>
      );

    case StateCode.INSUFFICIENT_EVIDENCE:
      return (
        <div role="status" aria-live="polite" style={{ padding: '24px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-amber)' }}>
          <p style={{ color: 'var(--signal-amber)', fontWeight: 600 }}>Not enough evidence.</p>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>We need more data to provide a confident answer.</p>
          {fallback}
        </div>
      );

    default:
      // Fallback for any future codes
      return <>{children}</>;
  }
};

export default StateWrapper;
