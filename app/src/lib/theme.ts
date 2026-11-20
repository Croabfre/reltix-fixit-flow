// Design tokens in three layers: primitive → semantic → component.
// Screens only use the semantic and component layers, so a re-skin means
// editing primitives (or re-pointing a semantic token) here and nowhere else.
//
// Taken from reltix.de (computed styles, Nov 2026): Baskervville for headlines
// with tight tracking, IBM Plex Sans for text, plum #330933 for ink and buttons,
// warm cream #FCF6EF canvas, grey #797979 for secondary text. Orange is kept
// only as a small "needs attention" accent.

// ---------------------------------------------------------------- 1. primitives

const palette = {
  // reltix.de
  plum: '#330933', // headings, buttons, text links
  plumDeep: '#2A072A', // button hover / pressed
  plum50: '#F4EEF3',
  plum100: '#E7DCE6',
  cream: '#FCF6EF', // page background
  sand: '#FAF6F2', // section background
  grey: '#797979', // secondary text
  black: '#1A1A1A', // body text
  white: '#FFFFFF',

  // supporting neutrals derived from the above
  line: '#EDE4DB',
  lineStrong: '#DCCFC3',
  subtle: '#A9A19A',
  sunken: '#F5EDE4',

  // accent (kept from our plan, used sparingly)
  orange600: '#D9561C',
  orange700: '#B4440F',
  orange50: '#FBEFE6',
  orange100: '#F3D9C6',

  green600: '#2F7D4F',
  green50: '#EAF3EC',
  amber600: '#B7791F',
  amber50: '#FAF2E2',
  red600: '#B42318',
  red50: '#FBEDEB',
  violet600: '#5B4B8A',
  violet50: '#F0EDF6',
};

// ---------------------------------------------------------------- 2. semantic

export const colors = {
  primary: palette.plum,
  primaryHover: palette.plumDeep,
  primarySoft: palette.plum50,
  primaryLine: palette.plum100,
  primaryOn: palette.white,

  accent: palette.orange600,
  accentHover: palette.orange700,
  accentSoft: palette.orange50,
  accentLine: palette.orange100,

  ink: palette.plum, // headings, strong text
  text: palette.black,
  muted: palette.grey,
  subtle: palette.subtle,
  border: palette.line, // hairlines
  borderStrong: palette.lineStrong,
  background: palette.cream,
  section: palette.sand,
  card: palette.white,
  sunken: palette.sunken,

  success: palette.green600,
  successSoft: palette.green50,
  warning: palette.amber600,
  warningSoft: palette.amber50,
  danger: palette.red600,
  dangerSoft: palette.red50,
  info: palette.violet600,
  infoSoft: palette.violet50,
};

export const fonts = {
  display: 'Baskervville_600SemiBold',
  displayRegular: 'Baskervville_500Medium',
  body: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
};

/** 4-pt grid. space(6) = 24. */
export const space = (n: number) => n * 4;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const type = {
  display: { size: 56, line: 60, tracking: -3 },
  displayCompact: { size: 42, line: 46, tracking: -2.2 },
  h2: { size: 32, line: 38, tracking: -1 },
  h3: { size: 16, line: 22 },
  body: { size: 16, line: 24 },
  small: { size: 13, line: 19 },
  label: { size: 11, tracking: 1.6 },
};

export const layout = {
  gutter: space(5), // page side padding
  sectionGap: space(7), // between cards / sections
  stackGap: space(4), // inside a card
  cardPadding: space(7),
  cardPaddingCompact: space(5),
  topbarHeight: 68,
};

// Very soft, wide shadow: lifts surfaces without drawing a box around them.
export const shadow = {
  shadowColor: palette.plum,
  shadowOpacity: 0.045,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 10 },
  elevation: 1,
};

// ---------------------------------------------------------------- 3. component

export const button = {
  height: { sm: 36, md: 46, lg: 56 },
  paddingX: { sm: 16, md: 22, lg: 30 },
  radius: 12, // reltix buttons: 12px, not pills
  variants: {
    primary: { bg: colors.primary, hover: colors.primaryHover, fg: colors.primaryOn, border: colors.primary },
    accent: { bg: colors.accent, hover: colors.accentHover, fg: palette.white, border: colors.accent },
    secondary: { bg: 'transparent', hover: colors.sunken, fg: colors.ink, border: colors.borderStrong },
    ghost: { bg: 'transparent', hover: colors.sunken, fg: colors.ink, border: 'transparent' },
    danger: { bg: 'transparent', hover: colors.dangerSoft, fg: colors.danger, border: colors.border },
  },
};

export const card = {
  bg: colors.card,
  border: colors.border,
  radius: radius.lg,
  padding: layout.cardPadding,
  accent: { bg: colors.section, border: colors.borderStrong },
  sunken: { bg: colors.sunken, border: colors.sunken },
};

type Tone = { fg: string; bg: string };
const tone = {
  neutral: { fg: colors.muted, bg: colors.sunken },
  info: { fg: colors.info, bg: colors.infoSoft },
  accent: { fg: colors.accentHover, bg: colors.accentSoft },
  plum: { fg: colors.primary, bg: colors.primarySoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
} satisfies Record<string, Tone>;

export const statusTone: Record<string, Tone> = {
  reported: tone.neutral,
  triaged: tone.info,
  partner_matched: tone.info,
  awaiting_pm_approval: tone.warning,
  job_sent: tone.accent,
  job_accepted: tone.accent,
  slot_offered: tone.warning,
  slot_confirmed: tone.accent,
  in_progress: tone.accent,
  completed: tone.success,
  invoiced: tone.success,
  closed: tone.neutral,
  partner_declined: tone.danger,
  no_slot_fits: tone.warning,
  escalated: tone.danger,
  service_request: tone.info,
  // job states (partner side)
  sent: tone.warning,
  accepted: tone.accent,
  scheduled: tone.accent,
  reschedule_requested: tone.warning,
  declined: tone.danger,
  // urgency
  emergency: tone.danger,
  high: tone.danger,
  normal: tone.info,
  low: tone.neutral,
};
