import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';
import type { HapticFeedback } from '@/lib/haptics';

const buttonVariants = cva(
  "group/button inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:hover:transform-none outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(16,185,129,0.10)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_30px_rgba(16,185,129,0.14)]',
        outline:
          'border-white/10 bg-white/[0.025] backdrop-blur-sm hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.055] hover:text-foreground aria-expanded:bg-white/[0.06] aria-expanded:text-foreground dark:bg-transparent',
        secondary:
          'bg-secondary/85 text-secondary-foreground hover:-translate-y-0.5 hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'bg-transparent hover:bg-white/[0.045] hover:text-foreground aria-expanded:bg-white/[0.055] aria-expanded:text-foreground dark:hover:bg-muted/45',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-11 gap-1.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "h-9 min-h-9 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-10 min-h-10 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        lg: 'h-12 gap-1.5 px-4.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        icon: 'size-11',
        'icon-xs': "size-7 min-h-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-10 min-h-10',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  haptic,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    haptic?: HapticFeedback | false;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  const hapticFeedback =
    haptic === undefined
      ? variant === 'destructive'
        ? 'warning'
        : 'selection'
      : haptic;

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-haptic={hapticFeedback === false ? undefined : hapticFeedback}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
