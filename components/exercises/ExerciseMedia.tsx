import { resolvedExerciseVideo, resolvedMediaUrl } from '@/lib/exercises/media';
import { cn } from '@/lib/ui/cn';

type ExerciseMediaProps = {
  name: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  emptyLabel: string;
  videoLabel: string;
  videoEmptyLabel?: string;
  imageTestId: string;
  videoTestId?: string;
  showVideoEmpty?: boolean;
  className?: string;
};

export function ExerciseMedia({
  name,
  imageUrl,
  videoUrl,
  emptyLabel,
  videoLabel,
  videoEmptyLabel,
  imageTestId,
  videoTestId,
  showVideoEmpty = false,
  className,
}: ExerciseMediaProps) {
  const imageSrc = resolvedMediaUrl(imageUrl);
  const video = resolvedExerciseVideo(videoUrl ?? null);

  return (
    <div className={cn('space-y-2', className)}>
      {imageSrc ? (
        // Native img: catalog URLs are remote and may 404 in smoke; tests assert the region.
        <img
          src={imageSrc}
          alt={name}
          className="w-full rounded-md"
          data-testid={imageTestId}
        />
      ) : (
        <div
          role="img"
          aria-label={name}
          className="flex min-h-40 w-full items-center justify-center rounded-md bg-brand-muted text-sm font-medium text-ink-muted"
          data-testid={imageTestId}
        >
          {emptyLabel}
        </div>
      )}

      {video ? (
        video.kind === 'youtube' ? (
          <div
            className="relative w-full overflow-hidden rounded-md bg-black"
            style={{ aspectRatio: '16 / 9' }}
          >
            <iframe
              src={video.embedUrl}
              title={videoLabel}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              data-testid={videoTestId}
            />
          </div>
        ) : (
          <video
            src={video.src}
            controls
            preload="metadata"
            playsInline
            className="w-full rounded-md bg-black"
            aria-label={videoLabel}
            data-testid={videoTestId}
          >
            {videoLabel}
          </video>
        )
      ) : showVideoEmpty ? (
        <p className="text-sm text-ink-muted" data-testid={videoTestId}>
          {videoEmptyLabel}
        </p>
      ) : null}
    </div>
  );
}
