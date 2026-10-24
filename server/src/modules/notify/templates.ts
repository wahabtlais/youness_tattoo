/**
 * The emails the studio sends, as plain text and simple HTML - rendered
 * when they're sent, from the payload stored with the queued message.
 * Every value is escaped into the HTML; nothing a visitor wrote can
 * become markup.
 */

export type Template = 'inquiry-received-owner' | 'inquiry-receipt-client' | 'password-reset';

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
