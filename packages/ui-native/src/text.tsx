import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

// The type scale from tokens.json (typography.*). Manrope only; nothing below 12 px.
const VARIANTS = {
  display: 'font-display text-40 leading-[44px] tracking-[-1.6px]',
  h1: 'font-display text-32 leading-[38px] tracking-[-0.96px]',
  h2: 'font-title text-24 leading-[30px]',
  h3: 'font-title text-20 leading-[26px]',
  title: 'font-title text-17 leading-[24px]',
  body: 'font-body text-16 leading-[24px]',
  'body-sm': 'font-body text-14 leading-[20px]',
  caption: 'font-caption text-12 leading-[16px]',
  label: 'font-display text-12 leading-[16px] uppercase tracking-[1.44px]',
} as const;

export interface TextProps extends NativeTextProps {
  variant?: keyof typeof VARIANTS;
  /** Secondary text colour (fg-2). */
  muted?: boolean;
}

export const Text = ({ variant = 'body', muted = false, className = '', ...props }: TextProps) => (
  <NativeText
    // Font scaling up to 200% without clipping (accessibility rule 2.4).
    maxFontSizeMultiplier={2}
    className={`${VARIANTS[variant]} ${muted ? 'text-fg-2' : 'text-fg'} ${className}`}
    {...props}
  />
);
