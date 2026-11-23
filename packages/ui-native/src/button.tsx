import { Pressable, type PressableProps } from 'react-native';
import { Text } from './text';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary';
  /** Copied from the design's data-testid, e.g. "welcome.cta.getStarted". */
  testID: string;
}

/** 48 px high, 4 px radius, monochrome. The label is the accessible name. */
export const Button = ({
  label,
  variant = 'primary',
  disabled,
  className = '',
  ...props
}: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    className={`h-12 min-w-touch items-center justify-center rounded-sm px-5 active:opacity-80 ${
      variant === 'primary' ? 'bg-inverse-bg' : 'border border-border-strong bg-bg'
    } ${disabled ? 'opacity-50' : ''} ${className}`}
    {...props}
  >
    <Text variant="title" className={variant === 'primary' ? 'text-inverse-fg' : 'text-fg'}>
      {label}
    </Text>
  </Pressable>
);
