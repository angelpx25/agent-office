// The company the office belongs to: its name on the signs in and outside the building, on the tab and
// the sign-in page, and what the corporate theme says it does (see features/brand/ in the client).

import type { FloorPalette } from './floors.js';

export const BRAND = {
  /** As the signs spell it. */
  name: 'DELTANET SERVICES',
  /** In a sentence. */
  short: 'DeltaNet',
  tagline: 'IT Services & Software Development',
  /** What the company does, one panel each on the west wall under the corporate theme. */
  services: [
    { title: 'Managed IT', body: 'Support · Networks · Endpoints' },
    { title: 'Software Development', body: 'Web · Mobile · APIs' },
    { title: 'Cloud & DevOps', body: 'Azure · AWS · CI/CD' },
    { title: 'Cybersecurity', body: 'Identity · Compliance · SOC' },
  ],
  /** The company colors: the signs' navy and the logo's blue and cyan. */
  navy: '#0b2545',
  blue: '#1f6feb',
  cyan: '#22c3e6',
} as const;

/** The corporate theme paints every floor alike: cool white walls, navy trim and grey planks. */
export const CORPORATE_LOOK: FloorPalette = { name: 'Corporate', wall: '#eef1f5', trim: '#1c2b45', floor: '#a9b2bd', floorAlt: '#9ea8b4', seam: '#87919e' };
