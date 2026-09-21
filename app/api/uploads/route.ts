import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { AppError } from '@/types/errors';
import type { UploadResponse } from '@/types/exercise';

const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const STORAGE_NOT_CONFIGURED_MESSAGE =
  'La subida de archivos necesita BLOB_READ_WRITE_TOKEN configurado. Podés pegar una URL https:// mientras tanto.';
const UNSUPPORTED_TYPE_MESSAGE = 'Solo se pueden subir imágenes o videos compatibles.';

function mediaKind(contentType: string): 'image' | 'video' | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  return null;
}

function assertSize(file: File, _kind: 'image' | 'video'): void {
  if (file.size <= SERVER_UPLOAD_MAX_BYTES) return;
  throw new AppError(
    'VALIDATION',
    'La subida directa no puede superar 4 MB por límite del servidor. Para videos grandes hace falta habilitar subida directa a Blob desde el cliente.',
  );
}

function safeFilename(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned || 'media';
}

async function parseFile(request: NextRequest): Promise<File> {
  const form = await request.formData();
  const value = form.get('file');
  if (!(value instanceof File) || value.size === 0) {
    throw new AppError('VALIDATION', 'Tenés que elegir un archivo para subir.');
  }
  return value;
}

/**
 * POST /api/uploads — authenticated media upload to public Vercel Blob storage.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const file = await parseFile(request);
    const kind = mediaKind(file.type);
    if (!kind) {
      throw new AppError('VALIDATION', UNSUPPORTED_TYPE_MESSAGE);
    }
    assertSize(file, kind);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new AppError('SERVICE_UNAVAILABLE', STORAGE_NOT_CONFIGURED_MESSAGE);
    }

    const pathname = `exercise-media/${session.userId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const blob = await put(pathname, file, { access: 'public', contentType: file.type });
    const body: UploadResponse = {
      url: blob.url,
      contentType: file.type,
      size: file.size,
      kind,
    };
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'VALIDATION', message: 'Formulario inválido' }, { status: 400 });
    }
    return handleApiError(error);
  }
}
