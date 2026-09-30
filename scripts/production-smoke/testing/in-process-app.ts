/**
 * Test-only in-process simulation of the deployed API.
 *
 * Adapts a `fetch`-shaped client to the real Next.js route handlers so runner
 * tests exercise the actual HTTP contracts against the migrated test DB.
 * Never used by production code, never contacts a network host.
 */
import { NextRequest } from 'next/server';

import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { GET as routinesGet } from '@/app/api/routines/route';
import { GET as streakGet } from '@/app/api/stats/streak/route';
import { GET as activeGet } from '@/app/api/workouts/active/route';
import { GET as workoutsGet, POST as workoutsPost } from '@/app/api/workouts/route';
import {
  DELETE as workoutDelete,
  GET as workoutGet,
  PATCH as workoutPatch,
} from '@/app/api/workouts/[id]/route';
import { GET as setsGet, POST as setsPost } from '@/app/api/workouts/[id]/sets/route';
import { GET as contextGet } from '@/app/api/workouts/[id]/exercises/[exerciseId]/context/route';
import {
  DELETE as noteDelete,
  PUT as notePut,
} from '@/app/api/workouts/[id]/exercises/[exerciseId]/note/route';

import type { FetchLike } from '../types';

export interface RequestLogEntry {
  method: string;
  path: string;
  cookie: string | null;
  status: number;
}

export interface InProcessApp {
  fetch: FetchLike;
  requests: RequestLogEntry[];
}

export interface InProcessAppOptions {
  /** Returns an overriding `Response`, or `null` to use the real route. */
  intercept?: (request: NextRequest, url: URL) => Promise<Response | null> | Response | null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function methodNotAllowed(): Response {
  return json(405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
}

async function dispatch(method: string, path: string, request: NextRequest): Promise<Response> {
  if (path === '/api/auth/login' && method === 'POST') {
    return loginPost(request);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return logoutPost(request);
  }
  if (path === '/api/auth/me' && method === 'GET') {
    return meGet(request);
  }
  if (path === '/api/routines' && method === 'GET') {
    return routinesGet(request);
  }
  if (path === '/api/stats/streak' && method === 'GET') {
    return streakGet(request);
  }
  if (path === '/api/workouts/active' && method === 'GET') {
    return activeGet(request);
  }
  if (path === '/api/workouts') {
    if (method === 'GET') {
      return workoutsGet(request);
    }
    if (method === 'POST') {
      return workoutsPost(request);
    }
    return methodNotAllowed();
  }

  const noteMatch = /^\/api\/workouts\/([^/]+)\/exercises\/([^/]+)\/note$/.exec(path);
  if (noteMatch) {
    const params = Promise.resolve({ id: noteMatch[1], exerciseId: noteMatch[2] });
    switch (method) {
      case 'PUT':
        return notePut(request, { params });
      case 'DELETE':
        return noteDelete(request, { params });
      default:
        return methodNotAllowed();
    }
  }

  const contextMatch = /^\/api\/workouts\/([^/]+)\/exercises\/([^/]+)\/context$/.exec(path);
  if (contextMatch) {
    if (method !== 'GET') {
      return methodNotAllowed();
    }
    return contextGet(request, {
      params: Promise.resolve({ id: contextMatch[1], exerciseId: contextMatch[2] }),
    });
  }

  const setsMatch = /^\/api\/workouts\/([^/]+)\/sets$/.exec(path);
  if (setsMatch) {
    const routeParams = { params: Promise.resolve({ id: setsMatch[1] }) };
    if (method === 'POST') {
      return setsPost(request, routeParams);
    }
    if (method === 'GET') {
      return setsGet(request, routeParams);
    }
    return methodNotAllowed();
  }

  const workoutMatch = /^\/api\/workouts\/([^/]+)$/.exec(path);
  if (workoutMatch) {
    const routeParams = { params: Promise.resolve({ id: workoutMatch[1] }) };
    switch (method) {
      case 'GET':
        return workoutGet(request, routeParams);
      case 'PATCH':
        return workoutPatch(request, routeParams);
      case 'DELETE':
        return workoutDelete(request, routeParams);
      default:
        return methodNotAllowed();
    }
  }

  return json(404, { code: 'NOT_FOUND', message: 'Route not found' });
}

export function createInProcessApp(options: InProcessAppOptions = {}): InProcessApp {
  const requests: RequestLogEntry[] = [];

  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const request = new NextRequest(input, {
      ...(init ?? {}),
      signal: init?.signal ?? undefined,
    });

    const intercepted = options.intercept ? await options.intercept(request, url) : null;
    const response = intercepted ?? (await dispatch(method, url.pathname, request));

    requests.push({
      method,
      path: url.pathname,
      cookie: request.headers.get('cookie'),
      status: response.status,
    });
    return response;
  };

  return { fetch: fetchImpl, requests };
}
