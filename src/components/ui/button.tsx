import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-navy text-white hover:bg-navy-600',
        teal: 'bg-teal text-white hover:bg-teal-700',
        outline: 'border border-border bg-white text-navy hover:bg-muted-bg',
        ghost: 'text-navy hover:bg-muted-bg',
        danger: 'bg-danger text-white hover:bg-danger/90',
        success: 'bg-success text-white hover:bg-success/90',
        link: 'text-teal underline-offset-4 hover:underline px-0 h-auto',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-6 text-base', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';
