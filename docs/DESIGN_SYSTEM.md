# Design system

This system is drawn from the hero, which is the visual benchmark. It doesn't invent a new language: everything new must look like it was printed on the same sheet.

Tokens live in one file, [`src/styles/theme.css`](../src/styles/theme.css). Each token is a Tailwind utility (`bg-paper`, `text-ink-muted`, `px-page-x`) and a CSS variable (`var(--color-paper)`). Tailwind's default palette, fonts, type scale, breakpoints, radii and shadows are switched off. If a value isn't a token, it isn't part of the language: add a token before using an arbitrary value.

## The idea: printed matter

The site is a sheet of paper with ink on it: a name set in a classic display face, a photograph printed into it, registration marks, margin rules, crop marks and plate numbers.

Depth comes from **layers sliding over one another** (parallax, the portrait crossing the name), never from shadows or glass. Interaction feels physical: a loupe develops the photograph, ink gives way under the cursor, prints are "developed" top-down as they arrive.

## Colour

| Token | Value | Use |
|---|---|---|
| `paper` | `#f3f1ec` | The sheet. Hero, work, booking, page body |
| `paper-light` | `#faf8f5` | A lifted sheet: dialogs, panels |
| `white` | `#ffffff` | Contrast sections (Studio), input fields |
| `ink` | `#14131a` | Type, rules, marks |
| `ink-soft` | `#4a4740` | Running copy on paper |
| `ink-muted` | `#8a867f` | Metadata, captions, secondary labels |
| `burgundy` | `#7a1d25` | **The only accent.** The O and E of YOUNES, "*you.*", active and hover states, the CTA rule |
| `burgundy-deep` | burgundy mixed 82% toward ink | Burgundy at display size, so giant letters don't shout |
| `focus` | `#8e1b23` | Keyboard focus ring only |
| `rule` | ink at 12% | Hairlines and frames |

Rules:
- Burgundy is used sparingly: one or two touches per view. It marks meaning ("you", the name's anchors, the thing you're acting on), never decoration.
- No other hues. Photographs bring their own colour; the interface stays ink on paper.
- Translucent ink uses the opacity modifier (`border-ink/50`), or `color-mix(in srgb, var(--color-ink) N%, transparent)` in hand-written CSS. Don't write raw `rgba(20, 19, 26, …)`.

## Typography

Two families, both loaded from Google Fonts in `index.html`:

- **Bodoni Moda** (`font-serif`): editorial display and reading serif. Variable optical size; display sizes use `opsz 96`.
- **DM Mono** (`font-mono`): the technical voice: labels, metadata, controls, running copy. It is the body default.

| Role | How | Seen in |
|---|---|---|
| Display | Serif 500, `opsz 96`, line-height 0.74, tracking −0.035em, uppercase, fitted margin to margin. Sized per section in its own CSS (`--fs`, `--wfs`). | YOUNES, THE WORK |
| Headline | `type-heading text-headline` | "Ready to make it yours?" |
| Title | `type-heading text-title` (often italic) | Dialog titles |
| Quote / lede | `font-serif text-quote` / `text-lede`, italic for emphasis | Pull quote, "The work is already in *you.*" |
| Eyebrow | `type-eyebrow` + `text-burgundy` or `text-ink-muted` | "YOUR IDEA", "CONSULTATION" |
| Label | `type-label` | Buttons, navigation |
| Meta | `type-meta text-ink-muted` | "DETROIT, MICHIGAN · BY APPOINTMENT" |
| Body | `text-body`, `leading-copy` for multi-line copy | Panel copy |

Rules:
- Serif speaks (names, headlines, the artist's voice). Mono labels (what something is, where, which number).
- Mono labels are always uppercase and tracked (0.18–0.26em).
- Italic serif plus burgundy is the emphasis: "*in mind?*", "*you.*"
- Typography is a utility (`type-*`), not a component. Use semantic elements (`h2`, `p`) and compose with utilities.

## Space and layout

| Token | Use |
|---|---|
| `page-x` / `page-y` | Page gutters, shared by the hero, nav and sections (`px-page-x`) |
| `margin-x` / `margin-y` | The printer's margin, where registration marks and margin rules sit |
| `section` | Vertical rhythm between editorial sections (`py-section`) |
| `corner` | Registration mark size |
| `max-w-page` | Content width: `min(1400px, 92vw)` |
| `max-w-measure` | Reading measure (42ch) |
| `max-w-dialog` | Dialog width (480px) |

Compositions are **asymmetric and editorial**: an editorial axis on the left, prints crossing type, offsets between columns. Avoid centred card grids. Mobile is its own composition, not a shrunk desktop (the hero's masthead name, the gallery's feed rhythm).

## Breakpoints

| Name | Range | Tailwind | Hand-written CSS |
|---|---|---|---|
| mobile | < 700px | default, `max-tablet:` | `(max-width: 699px)` |
| tablet | 700–1099px | `tablet:` | `(min-width: 700px) and (max-width: 1099px)` |
| desktop | ≥ 1100px | `desktop:` | `(min-width: 1100px)` |

Orientation matters for tablets: the hero and ink have portrait-tablet rules (`orientation: portrait`). Test at least 1920×1000, 1440×900, 1280×800, 820×1180 and 390×844.

## Shape: borders, radius, shadow

- **Borders** are 1px hairlines (`border-rule`, or `border-ink` for marks). Frames are crop marks or hairlines, never boxes with fills.
- **Radius:** none. Circles are the exception (`rounded-full`): the construction circle and the voice dial.
- **Shadows:** none. Depth is layering and parallax.

## Motion

Motion communicates **transition, discovery, physical material and editorial rhythm**. It is never there to entertain.

| Token | Value | Use |
|---|---|---|
| `ease-editorial` | `cubic-bezier(0.16, 1, 0.3, 1)` | The house curve: a quick start and a long settle. Almost everything |
| `ease-material` | `cubic-bezier(0.22, 0.8, 0.2, 1)` | Ink giving way and settling back |
| `--duration-fast` | 0.25s | Hover opacity, small state changes |
| `--duration-normal` | 0.45s | Colour, dial, fades |
| `--duration-slow` | 0.8s | Reveals, rules lengthening, sheets arriving |
| `animate-fade-in` / `animate-sheet-in` | | Dialog backdrop / panel arrival |

Established patterns:
- **Reveal:** content rises 18px and fades in once, the first time it enters (`components/ui/Reveal`).
- **Develop:** prints wipe in top-down and settle from 1.08 scale (Work).
- **Breathing:** portrait, type and marks share one 8s cycle, a few px. Felt, not seen.
- **Parallax:** planes drift against the pointer by depth (portrait 5px, type 10, ink 13, marks 18).
- **Scroll choreography:** every hero motion derives from one progress number (`--p`).

Avoid bouncing or springy UI, generic SaaS slide-ins, constant movement, and parallax outside the hero.

**Reduced motion** is designed, not just switched off. Under `prefers-reduced-motion: reduce`:
- Reveals are simply present.
- Ink shows its settled state, slightly quieter.
- Breathing, parallax and scroll choreography stop.
- Transitions shorten to near-instant.

In Tailwind use `motion-safe:` / `motion-reduce:`. In CSS use `@media (prefers-reduced-motion: reduce)`.

## Image treatment

- **Younes's work is never distorted, filtered into a style, or overlaid with text.** It is cropped (`object-fit: cover`) only into a deliberate editorial frame, or shown whole.
- Every image goes through `components/ui/ResponsiveImage`. That gives it srcset/sizes from its variants and its intrinsic size reserved (no layout shift). It is lazy unless above the fold, and keeps its focal point when cropped.
- 9:16 phone photographs can sit in 4:5 editorial frames (`ratio="4 / 5"`, cover, plus a `focal` point if the subject isn't centred).
- At rest, prints sit a touch quieter than the page and come to full clarity when you lean in (hover/focus on fine pointers only).
- Crop marks, not borders, frame a print.
- Generated concept images (future) are always labelled CONCEPT / REFERENCE, shown smaller than real work, and never framed like Younes's prints.

## Ink treatment

The hero's ink is final. It has exactly three elements, from licensed footage ([INK_ASSETS.md](INK_ASSETS.md)):
- A very large, extremely faded wash entering from the viewport's top-left edge behind the artist.
- One medium mark.
- One small mark.

Each lands, settles, holds, fades and rests on its own long, randomly phased cycle.

Rules:
- Ink is a material on the paper, not decoration. It stays faint (element opacity around 0.08–0.11) and under the type and portrait.
- Don't add ink elements to the hero, and don't spread ink to other sections without a design decision.
- Only licensed source material, documented in INK_ASSETS.md. The provided reference video is never shipped.

## Accessibility

Built in, not a later cleanup:
- **Semantic HTML.** Sections have headings (`aria-labelledby`). Decorative layers are `aria-hidden`. Display type has a hidden plain-text equivalent (`sr-only`).
- **Keyboard.** Everything is reachable and operable. Dialogs are native `<dialog>` (`components/ui/Dialog`): focus moves in and is contained, Escape closes, and focus returns to the opener.
- **Focus** is always visible: a 1.5px `focus` outline, offset from the element.
- **Nothing depends on hover.** Captions are always visible; hover only adds emphasis.
- **Alt text** is required by `ResponsiveImage`, and describes the work.
- **Contrast.** On paper: `ink` is 16.4:1, `ink-soft` 8.2:1 and `burgundy` 9.2:1, all passing WCAG AA. **`ink-muted` is 3.2:1, which fails AA for small text.** Today it carries non-essential metadata (place, ratio, "arriving soon"), and the same information is also available elsewhere. Never use it for copy someone needs to read. Darkening it (to about `#6f6b64`, 4.7:1) would change the hero's metadata, so it is an open design decision, not a silent fix.
- **State messages** are announced (`role="status"` / `role="alert"`, via `components/ui/StateMessage`).
- **Reduced motion** is respected everywhere (see Motion).
