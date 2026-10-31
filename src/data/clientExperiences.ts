import type { ClientExperiences } from '../domain/client';
import alexVoice from '../assets/testimonials/demo-voice-alex-morgan.wav';
import jordanVoice from '../assets/testimonials/demo-voice-jordan-lee.wav';

/**
 * Client experiences for the homepage.
 *
 * DEMO CONTENT - FICTIONAL TESTIMONIALS. No real client words have been
 * supplied with permission to publish yet, so these three are invented, by
 * request, to evaluate the section on the real page. The names are made up
 * and the people do not exist; the site labels the section and every entry
 * as fictional. They must be replaced (or the status set back to
 * 'awaiting') before launch - docs/ROADMAP.md.
 *
 * Their stand-ins are marked too:
 * - portraits are drawn placeholders (initials in a frame), not photographs;
 * - the two voice notes are Windows' built-in offline speech synthesizer
 *   (Microsoft David and Zira) reading the fictional quotes - synthetic,
 *   and labelled so beside the player. 16 kHz mono WAV, about 11 and 10 s.
 *   Their durations and waveform peaks were measured from the files.
 * Sam Taylor's is written only, to show a testimonial without a recording.
 * Jordan Lee's alone shows a sample artwork - a piece from Younes's
 * portfolio, captioned as a portfolio image - to compare an image-supported
 * testimonial with the others.
 *
 * To publish real testimonials, switch to 'published'. Each then needs the
 * client's words exactly as approved and their recorded consent:
 *
 *   export const CLIENT_EXPERIENCES: ClientExperiences = {
 *     status: 'published',
 *     testimonials: [
 *       {
 *         id: 'first-name-2025',
 *         quote: 'Their words, exactly as approved.',
 *         attribution: 'First name',
 *         workId: '03', // optional: the piece, if they agreed
 *         context: 'Forearm, 2025', // optional, approved by them
 *         consent: { date: '2025-11-02', via: 'Instagram message to Younes' },
 *         // optional: their photograph, only if they supplied it and agreed
 *         portrait: { image: portraitAsset, alt: 'First name, smiling, in the studio' },
 *         // optional: their own recording, with its own permission to be played
 *         // (import voiceNote from '../assets/testimonials/first-name-2025.m4a')
 *         voice: {
 *           src: voiceNote,
 *           consent: { date: '2025-11-02', via: 'Voice note and written OK on Instagram' },
 *         },
 *       },
 *     ],
 *   };
 */
export const CLIENT_EXPERIENCES: ClientExperiences = {
  status: 'demo',
  testimonials: [
    {
      demo: true,
      id: 'demo-idea',
      quote:
        'I came in with a rough idea and a folder of screenshots. We talked it through until it felt like mine, not something copied from someone else’s arm.',
      attribution: 'Alex Morgan',
      context: 'First tattoo',
      portrait: { placeholder: true, initials: 'AM' },
      voice: {
        synthetic: true,
        src: alexVoice,
        duration: 11.02,
        peaks: [
          0.63, 0.57, 0.94, 0.63, 0.43, 0.77, 0.71, 0.51, 0.43, 0.52, 0.81, 0.63, 0.44, 0.46, 0.77, 0.54, 0.4, 0.25, 0, 0,
          0, 0, 0.04, 0.57, 1, 0.42, 0.28, 0.81, 0.47, 0.6, 0.37, 0.78, 0.84, 0.73, 0.73, 0.14, 0, 0.26, 1, 0.74, 0.53,
          0.39, 0.8, 0.4, 0.65, 0.74, 0.84, 0.79, 0.49, 0.39, 0.8, 0.13, 0, 0, 0, 0,
        ],
      },
    },
    {
      demo: true,
      id: 'demo-concept',
      quote: 'He asked what the piece meant to me before anything was drawn. The design changed twice along the way, and I was part of every change.',
      attribution: 'Jordan Lee',
      context: 'Custom design',
      portrait: { placeholder: true, initials: 'JL' },
      // shown as "Portfolio image — demo": a real piece by Younes (04, the
      // black-and-grey forearm), to see artwork in the layout - not Jordan's
      sampleWorkId: '04',
      voice: {
        synthetic: true,
        src: jordanVoice,
        duration: 9.69,
        peaks: [
          0.03, 0.78, 0.73, 0.11, 0.54, 0.35, 0.77, 0.54, 0.75, 0.45, 0.84, 0.31, 0.72, 0.62, 0.68, 0.69, 0.41, 0.68, 0.64,
          0.19, 0, 0, 0, 0, 0, 0.49, 0.62, 1, 0.6, 0.95, 0.57, 0.13, 0.81, 0.44, 0.81, 0.68, 0.7, 0.47, 0.04, 0, 0.28, 0.67,
          0.55, 0.28, 0.78, 0.45, 0.64, 0.66, 0.69, 0.47, 0.43, 0.02, 0, 0, 0, 0,
        ],
      },
    },
    {
      demo: true,
      id: 'demo-appointment',
      quote: 'The appointment was unhurried. Each step was explained before we started, and I never felt pushed to decide anything on the spot.',
      attribution: 'Sam Taylor',
      portrait: { placeholder: true, initials: 'ST' },
    },
  ],
};
