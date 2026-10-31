/**
 * How a client's details are used - DRAFT WORDING, to be reviewed (and
 * checked against the law that applies to the studio) before the site goes
 * live: docs/PRIVACY_NOTICE_DRAFT.md. It says only what the system does
 * today: who sees the details, why, the one automatic email (a receipt),
 * the assistant (the idea only, never who sent it, and only if switched
 * on), how long they're kept (the studio's retention setting, 24 months by
 * default), and that nothing is sold or used for marketing.
 */
export function PrivacyNotice() {
  return (
    <details className="group text-micro leading-copy text-ink-soft">
      <summary className="cursor-pointer list-none type-meta text-ink underline decoration-rule underline-offset-4 hover:decoration-burgundy">How your details are used</summary>
      <div className="mt-3 grid max-w-measure gap-2">
        <p>Your idea and contact details go to Younes, and only to him. He uses them to read your idea and reply to you about it - nothing else. They are never sold, shared or used for marketing.</p>
        <p>You’ll get one email confirming your idea arrived, with its reference. Nothing else is sent to you automatically - any reply comes from Younes himself.</p>
        <p>If Younes uses the studio’s assistant to summarise an idea, the description of the idea (never your name or contact details) is sent to an AI service for that.</p>
        <p>They are kept while you and the studio are talking about your tattoo, and removed or anonymised after 24 months without activity once your inquiry is closed. You can ask Younes to see, correct or delete them at any time.</p>
        <p>A record of when you agreed to this is kept with your inquiry.</p>
        <p className="type-meta text-ink-muted">Draft notice - to be confirmed before launch.</p>
      </div>
    </details>
  );
}
