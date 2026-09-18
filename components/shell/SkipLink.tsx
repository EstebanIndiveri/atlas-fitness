import { UI_COPY } from '@/lib/copy/ui';

export function SkipLink() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-foreground"
    >
      {UI_COPY.skipToContent}
    </a>
  );
}
