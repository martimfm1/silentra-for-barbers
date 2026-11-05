'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  IconCircleCheck,
  IconInfoCircle,
  IconAlertTriangle,
  IconAlertOctagon,
  IconLoader,
} from '@tabler/icons-react';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      position="top-right"
      duration={4500}
      visibleToasts={4}
      closeButton
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <IconCircleCheck className="size-4" />,
        info: <IconInfoCircle className="size-4" />,
        warning: <IconAlertTriangle className="size-4" />,
        error: <IconAlertOctagon className="size-4" />,
        loading: <IconLoader className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'silentra-toast group',
          success: 'silentra-toast-success',
          error: 'silentra-toast-error',
          warning: 'silentra-toast-warning',
          info: 'silentra-toast-info',
          loading: 'silentra-toast-loading',
          title: 'silentra-toast-title',
          description: 'silentra-toast-description',
          actionButton: 'silentra-toast-action',
          cancelButton: 'silentra-toast-cancel',
          closeButton: 'silentra-toast-close',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
