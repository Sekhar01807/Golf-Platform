import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditActionPayload {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Persists an immutable administrative audit record
 */
export async function logAdminAction({
  actorId,
  action,
  targetType,
  targetId,
  details = {},
}: AuditActionPayload): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      actor_id: actorId || null,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      details,
    });
  } catch (err) {
    console.error('[Audit Log Failure]:', err);
  }
}
