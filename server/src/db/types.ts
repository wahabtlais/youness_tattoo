import type { ColumnType, Generated, Selectable } from 'kysely';

/**
 * The database as Kysely sees it - kept beside the migrations
 * (db/migrations) and checked against the real schema by the database
 * tests (test/schema.test.ts), so a column added to one is added to both.
 */

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | string | undefined, Date | string>;
/** jsonb: read as the value, written as a value or its JSON text */
type Json<T> = ColumnType<T, T | string, T | string>;
/** a timestamp the database fills in when it isn't given */
type DefaultTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type Numeric = ColumnType<string, number | string, number | string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  password_hash: string;
  role: Generated<'owner' | 'staff'>;
  totp_secret_enc: string | null;
  totp_enabled_at: Timestamp | null;
  totp_last_step: ColumnType<string | null, number | string | null, number | string | null>;
  password_changed_at: Generated<Date>;
  created_at: CreatedAt;
  disabled_at: Timestamp | null;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: Buffer;
  mfa_passed: Generated<boolean>;
  created_at: CreatedAt;
  last_seen_at: Generated<Date>;
  idle_expires_at: Timestamp;
  absolute_expires_at: Timestamp;
  revoked_at: Timestamp | null;
  ip: string | null;
  user_agent: string | null;
}

export interface TrustedDevicesTable {
  id: Generated<string>;
  user_id: string;
  token_hash: Buffer;
  created_at: CreatedAt;
  last_used_at: Generated<Date>;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  user_agent: string | null;
}

export interface PasswordResetsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: Buffer;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  created_at: CreatedAt;
}

export interface RecoveryCodesTable {
  id: Generated<string>;
  user_id: string;
  code_hash: Buffer;
  used_at: Timestamp | null;
  created_at: CreatedAt;
}

export interface AuthAttemptsTable {
  key: string;
  failures: Generated<number>;
  window_start: Timestamp;
  locked_until: Timestamp | null;
}

export interface StudioSettingsTable {
  id: Generated<number>;
  studio_name: Generated<string>;
  timezone: Generated<string>;
  notify_email: string | null;
  retention_months: Generated<number>;
  ai_daily_budget_usd: Numeric;
  ai_monthly_budget_usd: Numeric;
  updated_at: UpdatedAt;
}

export interface ActivityLogTable {
  id: Generated<string>;
  at: CreatedAt;
  actor_type: 'user' | 'website' | 'assistant' | 'system';
  actor_id: string | null;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  data: Json<Record<string, unknown>>;
}

export interface ImageVariantRow {
  key: string;
  width: number;
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  bytes: number;
}

export interface MediaAssetsTable {
  id: Generated<string>;
  visibility: 'public' | 'private';
  kind: 'image';
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  storage_key: string;
  variants: Json<ImageVariantRow[]>;
  alt: string | null;
  focal: Json<{ x: number; y: number }> | null;
  origin: string | null;
  created_by: string | null;
  created_at: CreatedAt;
  deleted_at: Timestamp | null;
}

export interface WorksTable {
  id: Generated<string>;
  number: number;
  slug: string;
  title: string;
  alt: string;
  image_id: string;
  description: string | null;
  subject: Generated<string[]>;
  style: Generated<string[]>;
  composition: Generated<string[]>;
  linework: Generated<string[]>;
  mood: Generated<string[]>;
  placement: string | null;
  colour: string | null;
  tags: Generated<string[]>;
  metadata_status: Generated<'demo' | 'verified'>;
  published: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface JournalPostsTable {
  id: Generated<string>;
  slug: string;
  kind: string;
  title: string;
  date: ColumnType<string, string, string>;
  summary: string;
  body: Json<string[]>;
  image: Json<Record<string, unknown>> | null;
  event: Json<{ name: string; location: string; start: string; end?: string }> | null;
  published: Generated<boolean>;
  demo: Generated<boolean>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface JournalPostWorksTable {
  post_id: string;
  work_id: string;
}
export interface JournalPostCallsTable {
  post_id: string;
  call_id: string;
}

export interface CanvasCallsTable {
  id: Generated<string>;
  slug: string;
  title: string;
  summary: string;
  description: Json<string[]>;
  status: 'upcoming' | 'open' | 'booked' | 'closed';
  artwork: Json<Record<string, unknown>>;
  placement: string | null;
  scale: string | null;
  offer: string | null;
  eligibility: Generated<string[]>;
  deadline: ColumnType<string | null, string | null, string | null>;
  event_post_id: string | null;
  published: Generated<boolean>;
  demo: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface CanvasCallWorksTable {
  call_id: string;
  work_id: string;
}

export interface TestimonialsTable {
  id: Generated<string>;
  ext_id: string;
  quote: string;
  attribution: string;
  work_id: string | null;
  context: string | null;
  consent_date: ColumnType<string | null, string | null, string | null>;
  consent_via: string | null;
  published: Generated<boolean>;
  demo: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface ContentDocumentsTable {
  key: string;
  draft: Json<Record<string, unknown>>;
  draft_updated_at: Timestamp | null;
  draft_updated_by: string | null;
  published_version: number | null;
}

export interface ContentVersionsTable {
  key: string;
  version: number;
  data: Json<Record<string, unknown>>;
  created_at: CreatedAt;
  created_by: string | null;
}

export interface ClientsTable {
  id: Generated<string>;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  preferred_contact: 'email' | 'phone' | 'instagram' | null;
  demo: Generated<boolean>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  archived_at: Timestamp | null;
  anonymized_at: Timestamp | null;
}

export interface InquiriesTable {
  id: Generated<string>;
  public_ref: string;
  client_id: string;
  status: Generated<string>;
  entry: Json<Record<string, unknown>>;
  summary: Json<Record<string, unknown>>;
  contact: Json<Record<string, unknown>>;
  idempotency_key: string | null;
  consent_at: Timestamp | null;
  privacy_notice_version: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  spam_score: Generated<number>;
  demo: Generated<boolean>;
  submitted_at: Timestamp;
  updated_at: UpdatedAt;
  anonymized_at: Timestamp | null;
}

export interface InquiryReferencesTable {
  id: Generated<string>;
  inquiry_id: string;
  kind: 'work' | 'upload' | 'external' | 'concept';
  work_number: number | null;
  media_id: string | null;
  url: string | null;
  note: string | null;
  position: Generated<number>;
}

export interface NotesTable {
  id: Generated<string>;
  client_id: string | null;
  inquiry_id: string | null;
  body: string;
  author_id: string | null;
  source: Generated<'user' | 'assistant'>;
  created_at: CreatedAt;
}

export interface FollowUpsTable {
  id: Generated<string>;
  client_id: string;
  inquiry_id: string | null;
  kind: 'reply' | 'reminder' | 'aftercare';
  reason: string;
  due_at: Timestamp;
  done_at: Timestamp | null;
  demo: Generated<boolean>;
  created_at: CreatedAt;
}

export interface AppointmentsTable {
  id: Generated<string>;
  client_id: string;
  inquiry_id: string | null;
  kind: 'session' | 'consultation' | 'aftercare';
  title: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  status: Generated<'proposed' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'>;
  prep: string | null;
  demo: Generated<boolean>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface AvailabilityTable {
  id: Generated<string>;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface EmailOutboxTable {
  id: Generated<string>;
  to_address: string;
  template: string;
  subject: string;
  payload: Json<Record<string, unknown>>;
  status: Generated<'pending' | 'sending' | 'sent' | 'failed'>;
  attempts: Generated<number>;
  max_attempts: Generated<number>;
  send_after: DefaultTimestamp;
  last_error: string | null;
  sent_at: Timestamp | null;
  related_type: string | null;
  related_id: string | null;
  created_at: CreatedAt;
}

export interface AiUsageTable {
  id: Generated<string>;
  at: CreatedAt;
  user_id: string | null;
  task: string;
  model: string;
  input_tokens: Generated<number>;
  output_tokens: Generated<number>;
  cost_usd: ColumnType<string, number | string | undefined, number | string>;
  status: 'ok' | 'error' | 'blocked';
  error: string | null;
}

export interface AiProposalsTable {
  id: Generated<string>;
  task: 'inquiry-summary' | 'reply-draft';
  inquiry_id: string;
  content: string;
  model: string | null;
  status: Generated<'pending' | 'approved' | 'rejected'>;
  created_by: string | null;
  created_at: CreatedAt;
  decided_by: string | null;
  decided_at: Timestamp | null;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  trusted_devices: TrustedDevicesTable;
  password_resets: PasswordResetsTable;
  recovery_codes: RecoveryCodesTable;
  auth_attempts: AuthAttemptsTable;
  studio_settings: StudioSettingsTable;
  activity_log: ActivityLogTable;
  media_assets: MediaAssetsTable;
  works: WorksTable;
  journal_posts: JournalPostsTable;
  journal_post_works: JournalPostWorksTable;
  journal_post_calls: JournalPostCallsTable;
  canvas_calls: CanvasCallsTable;
  canvas_call_works: CanvasCallWorksTable;
  testimonials: TestimonialsTable;
  content_documents: ContentDocumentsTable;
  content_versions: ContentVersionsTable;
  clients: ClientsTable;
  inquiries: InquiriesTable;
  inquiry_references: InquiryReferencesTable;
  notes: NotesTable;
  follow_ups: FollowUpsTable;
  appointments: AppointmentsTable;
  availability: AvailabilityTable;
  email_outbox: EmailOutboxTable;
  ai_usage: AiUsageTable;
  ai_proposals: AiProposalsTable;
}

export type User = Selectable<UsersTable>;
export type Session = Selectable<SessionsTable>;
