import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { MediaUploadControl } from './MediaUploadControl';
import { ROUTINE_COPY, ROUTINE_TEST_IDS } from '@/lib/copy/routines';

function mockFetch(response: { ok: boolean; status: number; body: unknown }): jest.MockedFunction<typeof fetch> {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  } as Response);
  global.fetch = fetchMock;
  return fetchMock;
}

describe('MediaUploadControl', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads a selected image file and returns a validated https URL', async () => {
    const onUploaded = jest.fn();
    const fetchMock = mockFetch({
      ok: true,
      status: 201,
      body: { url: 'https://blob.example.com/exercises/photo.png' },
    });

    render(<MediaUploadControl mediaType="image" onUploaded={onUploaded} />);
    const input = screen.getByTestId(ROUTINE_TEST_IDS.upload) as HTMLInputElement;

    expect(input.disabled).toBe(false);
    fireEvent.change(input, {
      target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
    });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith('https://blob.example.com/exercises/photo.png'));
    const form = fetchMock.mock.calls[0]?.[1]?.body;
    expect(fetchMock).toHaveBeenCalledWith('/api/uploads', expect.objectContaining({ method: 'POST' }));
    expect(form).toBeInstanceOf(FormData);
  });

  it('shows the server fallback error and keeps URL paste available', async () => {
    mockFetch({
      ok: false,
      status: 503,
      body: { code: 'SERVICE_UNAVAILABLE', message: 'Blob no configurado' },
    });

    render(<MediaUploadControl mediaType="video" onUploaded={jest.fn()} />);
    fireEvent.change(screen.getByTestId(ROUTINE_TEST_IDS.upload), {
      target: { files: [new File(['clip'], 'clip.mp4', { type: 'video/mp4' })] },
    });

    expect((await screen.findByRole('alert')).textContent).toContain('Blob no configurado');
    expect(screen.getByText(ROUTINE_COPY.uploadHint)).toBeTruthy();
  });

  it('rejects a non-https upload response before filling the editor field', async () => {
    const onUploaded = jest.fn();
    mockFetch({ ok: true, status: 201, body: { url: 'http://cdn.example.com/photo.png' } });

    render(<MediaUploadControl mediaType="image" onUploaded={onUploaded} />);
    fireEvent.change(screen.getByTestId(ROUTINE_TEST_IDS.upload), {
      target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
    });

    expect((await screen.findByRole('alert')).textContent).toContain(ROUTINE_COPY.uploadInvalidUrl);
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
