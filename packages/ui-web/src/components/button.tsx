import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

// Brand rules: 4 px radius, 48 px default height, monochrome, no shadows.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-[16px] font-bold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary:
          'border-[1.5px] border-border-strong bg-background text-foreground hover:bg-surface',
        ghost: 'text-foreground hover:bg-surface',
        destructive: 'bg-destructive text-inverse-fg hover:opacity-90',
      },
      size: {
        default: 'h-12 px-5',
        compact: 'h-9 px-3 text-[14px]',
        icon: 'size-12',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a link) with button styling. */
  asChild?: boolean;
}

export const Button = ({ className, variant, size, asChild = false, ...props }: ButtonProps) => {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
};
