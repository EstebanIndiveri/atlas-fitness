import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { ExerciseMedia } from './ExerciseMedia';

describe('ExerciseMedia', () => {
  it('renders an empty image placeholder when URL is missing', () => {
    render(
      <ExerciseMedia
        name="Press Banca"
        imageUrl={null}
        emptyLabel="Sin imagen"
        videoLabel="Ver video"
        imageTestId="routine-exercise-media"
      />,
    );
    const media = screen.getByTestId('routine-exercise-media');
    expect(media.tagName).not.toBe('IMG');
    expect(media.getAttribute('role')).toBe('img');
    expect(media.textContent).toBe('Sin imagen');
  });

  it.each(['http://cdn.example/x.png', 'javascript:alert(1)', 'data:text/html,hi'])(
    'shows placeholders and never puts untrusted scheme into src/href: %s',
    (unsafeUrl) => {
      render(
        <ExerciseMedia
          name="Press Banca"
          imageUrl={unsafeUrl}
          videoUrl={unsafeUrl}
          emptyLabel="Sin imagen"
          videoLabel="Ver video"
          videoEmptyLabel="Sin video"
          imageTestId="routine-exercise-media"
          videoTestId="routine-exercise-video"
          showVideoEmpty
        />,
      );
      const media = screen.getByTestId('routine-exercise-media');
      expect(media.tagName).not.toBe('IMG');
      expect(media.getAttribute('src')).toBeNull();
      expect(media.textContent).toBe('Sin imagen');
      const video = screen.getByTestId('routine-exercise-video');
      expect(video.tagName).not.toBe('A');
      expect(video.getAttribute('href')).toBeNull();
    },
  );

  it('renders image and an in-app video player for direct video files', () => {
    render(
      <ExerciseMedia
        name="Press Banca"
        imageUrl="https://cdn.example/bench.png"
        videoUrl="https://cdn.example/bench.mp4"
        emptyLabel="Sin imagen"
        videoLabel="Ver video"
        imageTestId="routine-exercise-media"
        videoTestId="routine-exercise-video"
      />,
    );
    expect(screen.getByTestId('routine-exercise-media').getAttribute('src')).toBe(
      'https://cdn.example/bench.png',
    );
    const video = screen.getByTestId('routine-exercise-video');
    expect(video.tagName).toBe('VIDEO');
    expect(video.getAttribute('src')).toBe('https://cdn.example/bench.mp4');
    expect(video.getAttribute('controls')).not.toBeNull();
  });

  it('embeds a privacy-friendly iframe for YouTube videos instead of an external link', () => {
    render(
      <ExerciseMedia
        name="Sentadilla"
        imageUrl={null}
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        emptyLabel="Sin imagen"
        videoLabel="Ver video"
        imageTestId="routine-exercise-media"
        videoTestId="routine-exercise-video"
      />,
    );
    const video = screen.getByTestId('routine-exercise-video');
    expect(video.tagName).toBe('IFRAME');
    expect(video.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(video.getAttribute('title')).toBe('Ver video');
  });

  it('treats youtube search links as a missing video', () => {
    render(
      <ExerciseMedia
        name="Sentadilla"
        imageUrl={null}
        videoUrl="https://www.youtube.com/results?search_query=sentadilla"
        emptyLabel="Sin imagen"
        videoLabel="Ver video"
        videoEmptyLabel="Sin video"
        imageTestId="routine-exercise-media"
        videoTestId="routine-exercise-video"
        showVideoEmpty
      />,
    );
    const video = screen.getByTestId('routine-exercise-video');
    expect(video.tagName).toBe('P');
    expect(video.textContent).toBe('Sin video');
  });
});
