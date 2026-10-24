# Privacy notice — DRAFT

> **Status: draft wording, not legal advice.** This describes what the system
> actually does today. It has **not** been reviewed by a lawyer and is not
> claimed to satisfy any law (for example the GDPR, UK GDPR, CCPA/CPRA or
> Michigan law). It must be reviewed, and completed with the studio's legal
> details, before the site takes real consultations.
>
> Version identifier: `2026-10-draft` (`PRIVACY_NOTICE_VERSION` in
> `packages/contracts/src/consultation.ts`). Each consultation records the
> version the visitor agreed to, with the time. Change the identifier
> whenever the wording changes.

The short form below is what the consultation shows, under "How your details
are used", above the consent checkbox
(`src/components/consultation/PrivacyNotice.tsx`).

## Short form, as shown

> Your idea and contact details go to Younes, and only to him. He uses them to
> read your idea and reply to you about it — nothing else. They are never sold,
> shared or used for marketing.
>
> You'll get one email confirming your idea arrived, with its reference.
> Nothing else is sent to you automatically — any reply comes from Younes
> himself.
>
> If Younes uses the studio's assistant to summarise an idea, the description
> of the idea (never your name or contact details) is sent to an AI service
> for that.
>
> They are kept while you and the studio are talking about your tattoo, and
> removed or anonymised after 24 months without activity once your inquiry is
> closed. You can ask Younes to see, correct or delete them at any time.
>
> A record of when you agreed to this is kept with your inquiry.

## What the system does (facts for the reviewer)

| Topic | What happens |
|---|---|
| **What is collected** | Name and email (required); phone and Instagram handle (optional); the answers to the consultation (the idea, its meaning, placement, size, timing, notes); the portfolio pieces or canvas call it started from; the time of consent and the notice version. Nothing is collected about visitors who don't submit: no analytics, no advertising or tracking cookies. |
| **Technical data** | With each inquiry: a keyed hash of the sender's network address (per day, not reversible without the server's secret) and their browser's user-agent string, for abuse prevention. Both are removed when the client is anonymised. Server logs record request lines, network addresses and timings, not form contents; how long logs are kept depends on the host. The only cookie is the studio's own sign-in cookie, used only by the owner. |
| **Who sees it** | The studio owner (Younes), signed in with password and two-factor authentication. No other accounts exist. |
| **Processors** | The hosting provider (stores the database and images). The email provider (delivers the receipt and the studio's own notices). OpenRouter and the model provider it routes to, **only if the assistant is switched on**, and only the idea's description: never name, email, phone or Instagram. Each needs to be named, with its location, in the final notice. |
| **Emails** | One automatic receipt to the visitor, with the reference. A notice to the studio's own address, if set. Password resets to the owner. Nothing else is sent automatically; replies are written by Younes in his own email. |
| **Retention** | Configurable in the studio (Settings), 24 months by default. Once every inquiry of a client is closed (declined or completed) and older than that, the client is anonymised: name, contact details and the free text of their ideas are removed, and the counts remain. Open inquiries are kept. |
| **Access, correction, deletion** | On request, by Younes. Name, phone and Instagram can be corrected in the client's record; the email identifies the client and isn't editable there. Deletion on request is done by the owner today; there's no self-service form. |
| **Security** | Passwords: Argon2id. Two-factor required. Authenticator secrets encrypted at rest. Sessions in HttpOnly, Secure cookies. The database is not reachable from the internet. Uploaded images have their metadata (location, camera) removed. |
| **Children** | Not addressed by the system. The final notice should state the studio's age policy. |
| **Changes** | A new wording gets a new version identifier. Earlier consents keep the version they agreed to. |

## To complete before launch

- The studio's legal name, postal address and a contact email for privacy
  requests.
- The legal basis, where the applicable law requires one (consent and/or steps
  at the person's request before a contract).
- The processors, with locations and any transfer mechanism. This depends on
  the chosen host and email provider.
- Whether the assistant will be used at all. If not, remove its sentence and
  keep `AI_ENABLED=false`.
- How long backups are kept (anonymisation applies to the live database; old
  backups expire on their own schedule).
- A reviewer's sign-off, then a new version identifier (e.g. `2027-01`).
