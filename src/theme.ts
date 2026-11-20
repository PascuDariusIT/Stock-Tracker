export type ThemeId = 'cyber-dark' | 'midnight-blue' | 'emerald-terminal';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  icon: string;
  bg: string;
  bodyGradient: string;
  cardBg: string;
  cardSelectedBg: string;
  innerBg: string;
  border: string;
  borderActive: string;
  accent: string;
  accentGradient: string;
  textPrimary: string;
  textMuted: string;
  glow: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'cyber-dark': {
    id: 'cyber-dark',
    name: 'Cyber Dark',
    icon: '⚡',
    bg: '#090d16',
    bodyGradient: 'radial-gradient(circle at top center, #111827 0%, #090d16 70%)',
    cardBg: '#131b2e',
    cardSelectedBg: '#1a2642',
    innerBg: '#0b101d',
    border: '#243049',
    borderActive: '#38bdf8',
    accent: '#38bdf8',
    accentGradient: 'linear-gradient(135deg, #38bdf8, #0284c7)',
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    glow: 'rgba(56, 189, 248, 0.25)',
  },
  'midnight-blue': {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    icon: '🌌',
    bg: '#060a17',
    bodyGradient: 'radial-gradient(circle at top center, #1e1b4b 0%, #060a17 75%)',
    cardBg: '#0f172a',
    cardSelectedBg: '#1e293b',
    innerBg: '#090e1c',
    border: '#1e294b',
    borderActive: '#818cf8',
    accent: '#818cf8',
    accentGradient: 'linear-gradient(135deg, #a5b4fc, #6366f1)',
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    glow: 'rgba(129, 140, 248, 0.25)',
  },
  'emerald-terminal': {
    id: 'emerald-terminal',
    name: 'Emerald Terminal',
    icon: '📟',
    bg: '#030c07',
    bodyGradient: 'radial-gradient(circle at top center, #062a1a 0%, #030c07 75%)',
    cardBg: '#091c13',
    cardSelectedBg: '#0f2f20',
    innerBg: '#04120a',
    border: '#133a25',
    borderActive: '#10b981',
    accent: '#10b981',
    accentGradient: 'linear-gradient(135deg, #34d399, #059669)',
    textPrimary: '#ecfdf5',
    textMuted: '#6ee7b7',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
};
