import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditActionPayload {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
  failClosed?: boolean;
}

/**
 * Persists an immutable administrative audit record.
 * Fails closed by default to guarantee full auditability of sensitive admin state mutations.
 */
export async function logAdminAction({
  actorId,
  action,
  targetType,
  targetId,
  details = {},
  failClosed = true,
}: AuditActionPayload): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('audit_logs').insert({
    actor_id: actorId || null,
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    details,
  });

  if (error) {
    if (failClosed) {
      throw new Error(`Mandatory audit record creation failed for action ${action}: ${error.message}`);
    }
  }
}
