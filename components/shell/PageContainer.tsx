import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6', className)}>
      {children}
    </div>
  );
}
