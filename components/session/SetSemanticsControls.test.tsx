import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { SetSemanticsControls } from './SetSemanticsControls';
import type { SemanticDraft, SessionSemanticsControls } from '@/lib/session/semantics-draft';

function controls(draft: Partial<SemanticDraft> = {}): SessionSemanticsControls {
  return {
    draft: {
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      setPurpose: 'working',
      repCountBasis: '',
      ...draft,
    },
    reused: false,
    onLoadMode: jest.fn(),
    onAmountBasis: jest.fn(),
    onSide: jest.fn(),
    onSetPurpose: jest.fn(),
    onRepCountBasis: jest.fn(),
  };
}

describe('SetSemanticsControls', () => {
  it('renders explicit load mode, basis, side and purpose chips', () => {
    render(<SetSemanticsControls {...controls()} />);

    expect(screen.getByTestId('semantics-loadMode-external').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('semantics-amountBasis-total')).toBeTruthy();
    expect(screen.getByTestId('semantics-side-bilateral')).toBeTruthy();
    expect(screen.getByTestId('semantics-purpose-working')).toBeTruthy();
    expect(screen.queryByTestId('semantics-repCountBasis-total')).toBeNull();
  });

  it('calls the matching handler when a chip is selected', () => {
    const props = controls();
    render(<SetSemanticsControls {...props} />);
    fireEvent.click(screen.getByTestId('semantics-loadMode-assisted'));
    expect(props.onLoadMode).toHaveBeenCalledWith('assisted');
  });

  it('hides the basis for bodyweight and shows the reused marker when set', () => {
    const props: SessionSemanticsControls = {
      ...controls({ loadMode: 'bodyweight', amountBasis: '' }),
      reused: true,
    };
    render(<SetSemanticsControls {...props} />);
    expect(screen.queryByTestId('semantics-amountBasis-total')).toBeNull();
    expect(screen.getByTestId('semantics-reused')).toBeTruthy();
  });

  it('requires and shows a rep-count basis for alternating', () => {
    render(<SetSemanticsControls {...controls({ side: 'alternating' })} />);
    expect(screen.getByTestId('semantics-repCountBasis-total')).toBeTruthy();
    expect(screen.getByTestId('semantics-repCountBasis-per_side')).toBeTruthy();
  });
});
