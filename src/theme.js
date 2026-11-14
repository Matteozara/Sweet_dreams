// Design tokens from the Stitch "Pastel Galaxy" design system.

export const colors = {
  bg: '#13121f',
  lowest: '#0e0d1a',
  low: '#1b1a27',
  container: '#1f1e2c',
  high: '#2a2836',
  highest: '#353342',

  text: '#e4e0f3',
  muted: '#cbc4d0',
  faint: 'rgba(203,196,208,0.6)',
  outline: '#958e9a',

  lilac: '#d4bbff',
  lilacPale: '#ebdcff',
  pink: '#f1b5d7',
  blue: '#cde5ff',
  blueDim: '#aacaea',
  ink: '#240d48',

  hairline: 'rgba(255,255,255,0.08)',
  glass: 'rgba(31,30,44,0.62)',
  glassStrong: 'rgba(36,33,55,0.82)',
  scrim: 'rgba(10,9,18,0.65)',
};

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
};

export const radius = { sm: 8, md: 16, lg: 24, xl: 32, full: 999 };

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, margin: 20 };

export const type = {
  display: { fontFamily: font.semibold, fontSize: 32, lineHeight: 40, letterSpacing: -0.4, color: colors.text },
  headline: { fontFamily: font.medium, fontSize: 18, lineHeight: 26, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 26, color: colors.text },
  bodySm: { fontFamily: font.regular, fontSize: 14, lineHeight: 22, color: colors.muted },
  label: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0.1, color: colors.muted },
  eyebrow: { fontFamily: font.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, color: colors.pink },
};

export const card = {
  backgroundColor: colors.glass,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.hairline,
};

// Shared motion durations, so everything that moves feels related.
export const motion = { fast: 120, base: 260, slow: 450 };

// Gradient stops shared by the day line and the primary button.
export const lineStops = [
  { offset: 0, color: colors.pink },
  { offset: 0.48, color: colors.lilac },
  { offset: 0.85, color: colors.blue },
  { offset: 1, color: '#ffffff' },
];
