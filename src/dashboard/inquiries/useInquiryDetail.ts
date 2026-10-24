import { useResource } from '../useResource';

/** what the studio knows about one inquiry beyond the overview: contact, notes, references, assistant proposals */
export interface InquiryDetailData {
  id: string;
  publicRef: string;
  status: string;
  receivedAt: string;
  consentAt: string | null;
  privacyNoticeVersion: string | null;
  demo: boolean;
  anonymized: boolean;
  client: { id: string; name: string; email: string | null; phone: string | null; instagram: string | null };
  notes: { id: string; body: string; source: 'user' | 'assistant'; createdAt: string }[];
  references: { kind: string; workId: string | null; note: string | null; url: string | null }[];
  proposals: { id: string; task: 'inquiry-summary' | 'reply-draft'; content: string; status: 'pending' | 'approved' | 'rejected'; model: string | null; createdAt: string; decidedAt: string | null }[];
}

export const useInquiryDetail = (id: string) => useResource<InquiryDetailData>(`/api/studio/inquiries/${id}`);
