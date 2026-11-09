/**
 * The emails the studio sends, as plain text and simple HTML - rendered
 * when they're sent, from the payload stored with the queued message.
 * Every value is escaped into the HTML; nothing a visitor wrote can
 * become markup.
 */

export type Template =
  | 'inquiry-received-owner'
  | 'inquiry-receipt-client'
  | 'password-reset'
  // the client portal (modules/client) - each says only that something is
  // waiting and links to it: no message text or health details in an email
  | 'client-verify-email'
  | 'client-account-exists'
  | 'client-password-reset'
  | 'client-new-message'
  | 'client-healing-response'
  | 'aftercare-reminder'
  | 'owner-client-message'
  | 'owner-healing-photo'
  | 'client-appointment-proposed'
  | 'client-appointment-answered'
  | 'owner-appointment-response'
  | 'owner-account-request';

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const page = (title: string, paragraphs: string[]) =>
  `<!doctype html><html><body style="font-family:Georgia,serif;color:#15161a;max-width:560px;margin:0 auto;padding:24px">` +
  `<h1 style="font-size:20px;font-weight:normal">${esc(title)}</h1>` +
  paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55">${p}</p>`).join('') +
  `<p style="font-size:12px;color:#5b6375">Younes Tattoo · Detroit, Michigan</p></body></html>`;

/** an email whose line `at` is a link: plain in the text version, a link in the HTML */
function link(subject: string, lines: string[], at: number, label: string): Rendered {
  return { subject, text: lines.join('\n\n'), html: page(subject, lines.map((l, i) => (i === at ? `<a href="${esc(l)}">${esc(label)}</a>` : esc(l)))) };
}

export function render(template: Template, p: Record<string, unknown>): Rendered {
  switch (template) {
    case 'inquiry-received-owner': {
      const subject = `New inquiry from ${p.name} (${p.ref})`;
      const lines = [`${p.name} sent a tattoo idea through the website.`, `Idea: ${p.concept || 'not described'}`, `Open it in the studio: ${p.link}`];
      return { subject, text: lines.join('\n\n'), html: page(subject, [esc(lines[0]), `<strong>Idea:</strong> ${esc(p.concept || 'not described')}`, `<a href="${esc(p.link)}">Open it in the studio</a>`]) };
    }
    case 'inquiry-receipt-client': {
      const subject = 'Younes received your tattoo idea';
      const lines = [
        `Hi ${p.name},`,
        `Your idea reached the studio (reference ${p.ref}). Younes reads every one himself and replies personally - usually by email.`,
        'Nothing is booked yet: he’ll be in touch to talk it through.',
      ];
      return { subject, text: lines.join('\n\n'), html: page(subject, lines.map(esc)) };
    }
    case 'client-verify-email': {
      const subject = 'Confirm your email for Younes Tattoo';
      const lines = [`Hi ${p.name},`, 'To finish creating your account, confirm this is your email address (the link works for 48 hours):', String(p.link), 'If you didn’t create an account, ignore this email - nothing happens.'];
      return link(subject, lines, 2, 'Confirm my email');
    }
    case 'client-account-exists': {
      const subject = 'You already have a Younes Tattoo account';
      const lines = ['Someone tried to create an account with this email address - but you already have one.', `Sign in: ${p.signIn}`, `Forgot your password? Choose a new one: ${p.reset}`, 'If it wasn’t you, ignore this email - nothing changes.'];
      return { subject, text: lines.join('\n\n'), html: page(subject, [esc(lines[0]), `<a href="${esc(p.signIn)}">Sign in</a>`, `<a href="${esc(p.reset)}">Choose a new password</a>`, esc(lines[3])]) };
    }
    case 'client-password-reset': {
      const subject = 'Reset your Younes Tattoo password';
      const lines = ['Someone asked to reset the password for your Younes Tattoo account.', 'To choose a new password, open this link within 30 minutes:', String(p.link), 'If it wasn’t you, ignore this email - nothing changes.'];
      return link(subject, lines, 2, 'Choose a new password');
    }
    case 'client-new-message': {
      const subject = 'Younes sent you a message';
      const lines = ['There’s a new message from Younes waiting in your account.', 'Read it here:', String(p.link)];
      return link(subject, lines, 2, 'Read the message');
    }
    case 'client-healing-response': {
      const subject = 'Younes answered your healing photo';
      const lines = ['Younes looked at the healing photo you sent and wrote back.', 'See his answer here:', String(p.link)];
      return link(subject, lines, 2, 'See his answer');
    }
    case 'aftercare-reminder': {
      const subject = `Aftercare for ${p.project}: ${p.stage}`;
      const lines = [`Your tattoo “${p.project}” has reached a new stage of healing: ${p.stage}.`, 'Younes’s instructions for this stage are in your account:', String(p.link)];
      return link(subject, lines, 2, 'Open your aftercare');
    }
    case 'owner-client-message': {
      const subject = `New message from ${p.name}`;
      const lines = [`${p.name} wrote to you from their client account.`, 'Open it in the studio:', String(p.link)];
      return link(subject, lines, 2, 'Open it in the studio');
    }
    case 'owner-healing-photo': {
      const subject = `${p.name} sent a healing photo`;
      const lines = [`${p.name} sent a healing progress photo.`, 'See it in the studio:', String(p.link)];
      return link(subject, lines, 2, 'See it in the studio');
    }
    case 'client-appointment-proposed': {
      const subject = 'Younes proposed a time for your session';
      const lines = [`Younes proposed ${p.when} for your session.`, 'Accept or decline it in your account - nothing is confirmed until you do:', String(p.link)];
      return link(subject, lines, 2, 'Answer in your account');
    }
    case 'client-appointment-answered': {
      const subject = p.accepted ? 'Your session is confirmed' : 'You declined the proposed time';
      const lines = p.accepted
        ? [`Your session on ${p.when} is confirmed.`, 'How to prepare, and everything else, is in your account:', String(p.link)]
        : [`You declined ${p.when}. Younes will be in touch about another time.`, 'Your account:', String(p.link)];
      return link(subject, lines, 2, 'Open your account');
    }
    case 'owner-appointment-response': {
      const subject = p.accepted ? `${p.name} accepted ${p.when}` : `${p.name} declined ${p.when}`;
      const lines = [p.accepted ? `${p.name} accepted the time you proposed: ${p.when}. It is confirmed in the calendar.` : `${p.name} declined the time you proposed: ${p.when}. It is cancelled in the calendar.`, 'Open the calendar:', String(p.link)];
      return link(subject, lines, 2, 'Open the calendar');
    }
    case 'owner-account-request': {
      const subject = `${p.name} asked for their account to be closed`;
      const lines = [`${p.name} asked for their client account to be closed. Nothing has been deleted - it waits for your review.`, 'Review it in the studio:', String(p.link)];
      return link(subject, lines, 2, 'Review it in the studio');
    }
    case 'password-reset': {
      const subject = 'Reset your studio password';
      const lines = [
        'Someone asked to reset the password for the Younes Tattoo studio.',
        `To choose a new password, open this link within 30 minutes: ${p.link}`,
        'If it wasn’t you, ignore this email - nothing changes.',
      ];
      return {
        subject,
        text: lines.join('\n\n'),
        html: page(subject, [esc(lines[0]), `<a href="${esc(p.link)}">Choose a new password</a> (within 30 minutes)`, esc(lines[2])]),
      };
    }
  }
}
