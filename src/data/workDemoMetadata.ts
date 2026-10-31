import type { TattooTraits } from '../domain/work';

/**
 * DEMO METADATA - FICTIONAL. NOT ABOUT YOUNES'S ACTUAL WORK.
 *
 * Sample descriptions, keyed by piece id, so Find Similar's matching can be
 * built and tested before real metadata exists. The values were assigned to
 * give the matching varied, overlapping and incomplete data to work with -
 * they do NOT describe what is in the photographs, and must never be shown
 * or repeated as facts. Every piece that uses them is marked
 * `metadataStatus: 'demo'` (data/work.ts).
 *
 * Replace this file with verified metadata from Younes (through the future
 * dashboard / API) before launch - see docs/ARCHITECTURE.md, "Tattoo
 * metadata". Deliberately uneven: 06 is partial and 08 is empty, so ranking
 * is exercised with missing values too.
 */
export const DEMO_METADATA: Record<string, TattooTraits> = {
  '01': {
    subject: ['portrait'],
    style: ['realism'],
    composition: ['centred'],
    linework: ['intricate'],
    mood: ['dark'],
    placement: 'forearm',
    colour: 'black-and-grey',
    tags: ['shading', 'face'],
  },
  '02': {
    subject: ['botanical'],
    style: ['fine-line'],
    composition: ['flowing'],
    linework: ['delicate'],
    mood: ['calm', 'delicate'],
    placement: 'upper-arm',
    colour: 'black-and-grey',
    tags: ['leaves'],
  },
  '03': {
    subject: ['figure', 'mythological'],
    style: ['realism', 'illustrative'],
    composition: ['sleeve', 'flowing'],
    linework: ['intricate'],
    mood: ['dramatic', 'dark'],
    placement: 'leg',
    colour: 'colour',
    tags: ['narrative'],
  },
  '04': {
    subject: ['animal'],
    style: ['blackwork'],
    composition: ['symmetrical', 'centred'],
    linework: ['bold'],
    mood: ['dark'],
    placement: 'forearm',
    colour: 'black-and-grey',
  },
  '05': {
    subject: ['figure'],
    style: ['illustrative', 'neo-traditional'],
    composition: ['full-coverage'],
    linework: ['bold'],
    mood: ['playful'],
    placement: 'calf',
    colour: 'colour',
  },
  '06': {
    subject: ['mythological'],
    mood: ['dramatic'],
  },
  '07': {
    subject: ['ornamental', 'geometric'],
    style: ['ornamental'],
    composition: ['symmetrical'],
    linework: ['intricate'],
    placement: 'back',
  },
  '08': {},
};
