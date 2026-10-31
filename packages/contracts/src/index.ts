export * from './auth.ts';
export * from './consultation.ts';
export * from './content.ts';
export * from './studio.ts';

/** an API error, as every endpoint returns it (application/problem+json) */
export interface ApiProblem {
  status: number;
  /** a stable machine code: 'validation', 'unauthenticated', 'conflict', … */
  code: string;
  title: string;
  /** per-field messages for forms */
  fields?: Record<string, string>;
}
export * from './html.ts';
