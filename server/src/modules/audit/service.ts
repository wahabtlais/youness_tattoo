import type { Executor } from '../../db/index.ts';

/**
 * The studio's history: who did what to which record, written in the same
 * transaction as the change. Append-only in the database itself. It holds
 * ids and the facts of a change (a status, a version) - never contact
 * details, which stay on their own records where they can be anonymised.
 */
export type Actor = { type: 'user'; id: string } | { type: 'website' } | { type: 'assistant'; id?: string } | { type: 'system' };

export async function record(
  db: Executor,
  actor: Actor,
  action: string,
  subject?: { type: string; id: string },
  data: Record<string, unknown> = {},
) {
  await db
    .insertInto('activity_log')
    .values({
      actor_type: actor.type,
      actor_id: 'id' in actor ? (actor.id ?? null) : null,
      action,
      subject_type: subject?.type ?? null,
      subject_id: subject?.id ?? null,
      data: JSON.stringify(data) as never,
    })
    .execute();
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: 'you' | 'assistant' | 'website' | 'system';
  action: string;
  subjectType: string | null;
  subjectId: string | null;
  text: string;
  data: Record<string, unknown>;
}

/** an action in words, for the dashboard's recent activity */
function describe(action: string, data: Record<string, unknown>): string {
  const d = data as Record<string, string>;
  switch (action) {
    case 'demo.event':
      return String(d.text ?? '');
    case 'inquiry.submitted':
      return `New inquiry from ${d.name ?? 'the website'}`;
    case 'inquiry.status':
      return `Moved ${d.name ?? 'an inquiry'} to ${d.label ?? d.status}`;
    case 'inquiry.note':
    case 'client.note':
      return `Added a note${d.name ? ` for ${d.name}` : ''}`;
    case 'follow_up.created':
      return `Set a follow-up${d.name ? ` for ${d.name}` : ''}`;
    case 'follow_up.done':
      return `Completed a follow-up${d.name ? ` for ${d.name}` : ''}`;
    case 'appointment.created':
      return `Added ${d.kind ?? 'an appointment'}${d.name ? ` with ${d.name}` : ''}`;
    case 'appointment.updated':
      return `Updated an appointment${d.name ? ` with ${d.name}` : ''}${d.status ? ` (${d.status})` : ''}`;
    case 'content.draft':
      return 'Saved website changes to the draft';
    case 'content.published':
      return `Published the website content (version ${d.version})`;
    case 'content.rollback':
      return `Restored website content version ${d.from} (now version ${d.version})`;
    case 'work.updated':
      return `Updated piece ${d.number ?? ''}`.trim();
    case 'work.created':
      return `Added piece ${d.number ?? ''} to the portfolio`.trim();
    case 'media.uploaded':
      return 'Uploaded an image';
    case 'auth.login':
      return 'Signed in';
    case 'auth.mfa_enrolled':
      return 'Turned on two-factor sign-in';
    case 'auth.password_changed':
      return 'Changed the password';
    case 'ai.proposal':
      return `The assistant prepared a ${d.task === 'reply-draft' ? 'reply draft' : 'summary'} — waiting for your approval`;
    case 'ai.proposal_decided':
      return `${d.decision === 'approve' ? 'Approved' : 'Rejected'} an assistant ${d.task === 'reply-draft' ? 'reply draft' : 'summary'}`;
    default:
      return action.replace(/[._]/g, ' ');
  }
}

export async function recent(db: Executor, limit = 50, subject?: { type: string; id: string }): Promise<ActivityEntry[]> {
  let q = db.selectFrom('activity_log').selectAll().orderBy('at', 'desc').orderBy('id', 'desc').limit(limit);
  if (subject) q = q.where('subject_type', '=', subject.type).where('subject_id', '=', subject.id);
  // sign-ins are history, not studio activity
  else q = q.where('action', 'not like', 'auth.%');
  const rows = await q.execute();
  // names are looked up now, not stored in the history: an anonymised client stays anonymous here too
  const inquiryIds = [...new Set(rows.filter((r) => r.subject_type === 'inquiry' && r.subject_id).map((r) => r.subject_id!))];
  const clientIds = [...new Set(rows.filter((r) => r.subject_type === 'client' && r.subject_id).map((r) => r.subject_id!))];
  const names = new Map<string, string>();
  if (inquiryIds.length) {
    for (const r of await db.selectFrom('inquiries as i').innerJoin('clients as c', 'c.id', 'i.client_id').select(['i.id', 'c.name']).where('i.id', 'in', inquiryIds).execute()) names.set(`inquiry:${r.id}`, r.name);
  }
  if (clientIds.length) {
    for (const r of await db.selectFrom('clients').select(['id', 'name']).where('id', 'in', clientIds).execute()) names.set(`client:${r.id}`, r.name);
  }
  return rows.map((r) => {
    const name = r.subject_type && r.subject_id ? names.get(`${r.subject_type}:${r.subject_id}`) : undefined;
    return {
      id: String(r.id),
      at: new Date(r.at).toISOString(),
      actor: r.actor_type === 'user' ? 'you' : r.actor_type,
      action: r.action,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      text: describe(r.action, name ? { ...r.data, name } : r.data),
      data: r.data,
    };
  });
}
