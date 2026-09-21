'use client';

import { useId, useState } from 'react';

import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';
import { isValidMediaUrl } from '@/lib/validation/media-url';

type MediaUploadControlProps = {
  mediaType: 'image' | 'video';
  disabled?: boolean;
  disabledReason?: string;
  onUploaded: (url: string) => void;
};

type UploadErrorBody = { message?: unknown };

function errorMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null && typeof (body as UploadErrorBody).message === 'string') {
    return (body as { message: string }).message;
  }
  return ROUTINE_COPY.uploadGenericError;
}

function acceptFor(mediaType: 'image' | 'video'): string {
  return mediaType === 'image' ? 'image/*' : 'video/*';
}

/** Uploads one image/video file and returns a validated public media URL to the editor. */
export function MediaUploadControl({
  mediaType,
  disabled = false,
  disabledReason = ROUTINE_COPY.uploadDisabled,
  onUploaded,
}: MediaUploadControlProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = mediaType === 'image' ? ROUTINE_COPY.uploadImageLabel : ROUTINE_COPY.uploadVideoLabel;

  async function onChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        setError(errorMessage(body));
        return;
      }
      const url = typeof body === 'object' && body !== null && 'url' in body ? body.url : null;
      if (typeof url !== 'string' || !isValidMediaUrl(url)) {
        setError(ROUTINE_COPY.uploadInvalidUrl);
        return;
      }
      onUploaded(url);
      setMessage(ROUTINE_COPY.uploadSuccess);
    } catch {
      setError(ROUTINE_COPY.uploadGenericError);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        disabled={disabled || uploading}
        accept={acceptFor(mediaType)}
        className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-brand-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
        data-testid={ROUTINE_TEST_IDS.upload}
        aria-describedby={hintId}
        onChange={(event) => void onChange(event)}
      />
      <p id={hintId} className="text-xs text-ink-muted">
        {disabled ? disabledReason : uploading ? ROUTINE_COPY.uploadUploading : ROUTINE_COPY.uploadHint}
      </p>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
    </div>
  );
}
