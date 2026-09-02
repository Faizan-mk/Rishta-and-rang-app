import { supabase } from './supabase';
import type { ReportReasonKey } from '../components/common/ReportDialog';

/** Where the report was raised from — kept with the row so a moderator has context. */
export type ReportContext = 'chat' | 'discover' | 'profile';

export interface ReportInput {
  targetId: string;
  reason: ReportReasonKey;
  /** The reporter's own words, when they chose "other". */
  details?: string;
  context: ReportContext;
}

/** Postgres unique-violation. Here it means "you already reported this person". */
const UNIQUE_VIOLATION = '23505';

/**
 * Files a report against another member.
 *
 * `reports` is insert-only by RLS and has no select policy at all, so this
 * cannot read anything back — not even the row it just wrote. That is
 * deliberate: nobody should be able to enumerate who reported whom, or find
 * out that they have been reported.
 *
 * A plain insert, never an upsert: an upsert is `INSERT ... ON CONFLICT DO
 * UPDATE` underneath and needs UPDATE rights, which would undo the insert-only
 * guarantee above. Reporting the same person twice therefore trips the unique
 * constraint, and that is treated as success — the standing report is already
 * on file, and either way one member cannot reach the auto-hide threshold alone.
 */
async function submitReport(reporterId: string, input: ReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details?.trim() ?? '',
    context: input.context,
    status: 'pending',
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

export const reportsService = { submitReport };
