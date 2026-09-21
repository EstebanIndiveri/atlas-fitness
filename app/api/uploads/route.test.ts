/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type Put = (pathname: string, body: File, options: { access: 'public'; contentType: string }) => Promise<{ url: string }>;

const mockRequireAuth = jest.fn<RequireAuth>();
const mockPut = jest.fn<Put>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return { ...actual, requireAuth: mockRequireAuth };
});

jest.mock('@vercel/blob', () => ({ put: mockPut }), { virtual: true });

let POST: typeof import('./route')['POST'];
const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

function multipartRequest(file: File | null): NextRequest {
  const form = new FormData();
  if (file) {
    form.set('file', file);
  }
  return new NextRequest('http://localhost:3000/api/uploads', { method: 'POST', body: form });
}

describe('POST /api/uploads', () => {
  beforeAll(async () => {
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockPut.mockReset();
    mockRequireAuth.mockResolvedValue({ userId: 7 } as Awaited<ReturnType<RequireAuth>>);
    process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it('uploads a valid image to Vercel Blob and returns its public URL', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token';
    mockPut.mockResolvedValue({ url: 'https://blob.example.com/exercises/photo.png' });

    const response = await POST(multipartRequest(new File(['avatar'], 'photo.png', { type: 'image/png' })));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      url: 'https://blob.example.com/exercises/photo.png',
      contentType: 'image/png',
      size: 6,
    });
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringMatching(/^exercise-media\/7\/[a-f0-9-]+-photo\.png$/),
      expect.any(File),
      { access: 'public', contentType: 'image/png' },
    );
  });

  it('returns a typed fallback error when Blob storage is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const response = await POST(multipartRequest(new File(['video'], 'clip.mp4', { type: 'video/mp4' })));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'La subida de archivos necesita BLOB_READ_WRITE_TOKEN configurado. Podés pegar una URL https:// mientras tanto.',
    });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('rejects unsupported content types and files over the per-media size cap', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token';

    const textResponse = await POST(multipartRequest(new File(['x'], 'note.txt', { type: 'text/plain' })));
    expect(textResponse.status).toBe(400);
    await expect(textResponse.json()).resolves.toMatchObject({ code: 'VALIDATION' });

    const bigImage = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    const bigResponse = await POST(multipartRequest(bigImage));
    expect(bigResponse.status).toBe(400);
    await expect(bigResponse.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'La subida directa no puede superar 4 MB por límite del servidor. Para videos grandes hace falta habilitar subida directa a Blob desde el cliente.',
    });
    expect(mockPut).not.toHaveBeenCalled();
  });
});
