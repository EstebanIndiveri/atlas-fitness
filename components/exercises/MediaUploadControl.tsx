import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';

type MediaUploadControlProps = {
  disabledReason?: string;
};

export function MediaUploadControl({
  disabledReason = ROUTINE_COPY.uploadDisabled,
}: MediaUploadControlProps) {
  return (
    <div className="space-y-1">
      <label htmlFor="routine-media-upload" className="block text-sm font-medium text-ink">
        {ROUTINE_COPY.uploadLabel}
      </label>
      <input
        id="routine-media-upload"
        type="file"
        disabled
        accept="image/*,video/*"
        className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-brand-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
        data-testid={ROUTINE_TEST_IDS.upload}
        aria-describedby="routine-media-upload-hint"
      />
      <p id="routine-media-upload-hint" className="text-xs text-ink-muted">
        {disabledReason}
      </p>
    </div>
  );
}
