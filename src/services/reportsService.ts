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

/**
 * Files a report against another member.
 *
 * `reports` is insert-only by RLS and has no select policy at all, so this
 * cannot read anything back — not even the row it just wrote. That is
 * deliberate: nobody should be able to enumerate who reported whom, or find
 * out that they have been reported.
 *
 * Reporting the same person twice updates the existing row rather than adding a
 * second one, so no single member can drive the auto-hide threshold alone.
 */
async function submitReport(reporterId: string, input: ReportInput): Promise<void> {
  const { error } = await supabase.from('reports').upsert(
    {
      reporter_id: reporterId,
      target_id: input.targetId,
      reason: input.reason,
      details: input.details?.trim() ?? '',
      context: input.context,
      status: 'pending',
    },
    { onConflict: 'reporter_id,target_id' }
  );
  if (error) throw new Error(error.message);
}

export const reportsService = { submitReport };
