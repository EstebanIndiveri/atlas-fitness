import type { SVGProps } from 'react';

import { cn } from '@/lib/ui/cn';
import {
  ATLAS_ICON_PATHS,
  ATLAS_ICON_STROKE_WIDTH,
  ATLAS_ICON_VIEW_BOX,
} from './atlas-icons';
import type { AtlasIconName, AtlasIconSize } from './atlas-icons';

const SIZE_CLASS: Record<AtlasIconSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

export type AtlasIconProps = Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> & {
  /** Typed governed icon name. Unknown names are a compile-time error. */
  name: AtlasIconName;
  /** Governed optical size token; defaults to the 20px optical target. */
  size?: AtlasIconSize;
};

/**
 * Canonical Atlas icon primitive.
 *
 * Renders one governed 24 × 24 SVG in `currentColor`. The icon is always
 * decorative (`aria-hidden`); the surrounding button/link owns the accessible
 * name so meaning never lives in the path shape alone.
 *
 * @param props Governed name, optical size and standard SVG attributes.
 * @returns A decorative Atlas SVG.
 * @example
 * <AtlasIcon name="complete" size="md" />
 */
export function AtlasIcon({ name, size = 'md', className, ...props }: AtlasIconProps) {
  return (
    <svg
      {...props}
      viewBox={ATLAS_ICON_VIEW_BOX}
      className={cn(SIZE_CLASS[size], 'shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={ATLAS_ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ATLAS_ICON_PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
