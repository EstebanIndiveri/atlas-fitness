/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { readOnboardingAnswers, saveOnboardingAnswers } from '@/lib/onboarding/state';
import type { UserPreferences } from '@/types/user-preferences';

import { ProfileCoachContext } from './ProfileCoachContext';

const EMPTY_PREFERENCES = { goal: null, pace: null, equipment: null };

function preferencesResponse(
  hasSavedPreferences: boolean,
  preferences: UserPreferences = EMPTY_PREFERENCES,
) {
  return { hasSavedPreferences, preferences };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function setFetchResponses(...responses: Response[]) {
  const fetchMock = jest.fn<typeof fetch>(async () => {
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected fetch request');
    }
    return response;
  });
  global.fetch = fetchMock;
  return fetchMock;
}

describe('ProfileCoachContext', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('shows saved server preferences without importing browser answers', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    const fetchMock = setFetchResponses(jsonResponse(preferencesResponse(true, {
      goal: 'strength',
      pace: 'days-2',
      equipment: 'gym',
    })));

    render(<ProfileCoachContext />);

    expect(await screen.findByText('Ganar fuerza')).toBeTruthy();
    expect(screen.getByText('2 días por semana')).toBeTruthy();
    expect(screen.getByText('Gimnasio completo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Revisar respuestas anteriores' })).toBeNull();
    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/profile/preferences');
  });

  it('opens the persisted preference editor from personal goal and equipment controls', async () => {
    setFetchResponses(jsonResponse(preferencesResponse(true, {
      goal: 'strength',
      pace: 'days-3',
      equipment: 'gym',
    })));

    render(<ProfileCoachContext />);

    fireEvent.click(await screen.findByRole('button', { name: 'Editar objetivo personal' }));
    expect(screen.getByLabelText('Objetivo personal')).toHaveProperty('value', 'strength');
    expect(screen.getByLabelText('Ritmo')).toHaveProperty('value', 'days-3');
    expect(screen.getByLabelText('Equipo disponible')).toHaveProperty('value', 'gym');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar equipo disponible' }));
    expect(screen.getByLabelText('Objetivo personal')).toHaveProperty('value', 'strength');
    expect(screen.getByLabelText('Equipo disponible')).toHaveProperty('value', 'gym');
  });

  it('treats an all-null saved row as saved and does not offer legacy import', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    setFetchResponses(jsonResponse(preferencesResponse(true)));

    render(<ProfileCoachContext />);

    expect(await screen.findByText('Guardadas en tu perfil')).toBeTruthy();
    expect(screen.getAllByText('Sin elegir')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Editar preferencias' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Revisar respuestas anteriores' })).toBeNull();
  });

  it('only previews valid legacy answers after the user asks to review them', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    setFetchResponses(jsonResponse(preferencesResponse(false)));

    render(<ProfileCoachContext />);

    expect(await screen.findByText('Todavía no guardaste preferencias de Coach.')).toBeTruthy();
    expect(screen.queryByText('Respuestas anteriores de este navegador')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));

    expect(await screen.findByText('Respuestas anteriores de este navegador')).toBeTruthy();
    expect(screen.getByText('Ganar músculo')).toBeTruthy();
    expect(screen.getByText('3 días por semana')).toBeTruthy();
    expect(screen.getByText('Mancuernas en casa')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeTruthy();
  });

  it('imports only after confirmation with a conditional write and refreshes preferences', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    const fetchMock = setFetchResponses(
      jsonResponse(preferencesResponse(false)),
      jsonResponse(preferencesResponse(false)),
      jsonResponse(preferencesResponse(true, {
        goal: 'muscle',
        pace: 'days-3',
        equipment: 'dumbbells',
      })),
      jsonResponse(preferencesResponse(true, {
        goal: 'muscle',
        pace: 'days-3',
        equipment: 'dumbbells',
      })),
    );

    render(<ProfileCoachContext />);
    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));
    await screen.findByText('Respuestas anteriores de este navegador');
    expect(fetchMock.mock.calls).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));

    await screen.findByText('Las respuestas anteriores ya están guardadas en tu cuenta.');
    expect(await screen.findByText('Ganar músculo')).toBeTruthy();
    expect(readOnboardingAnswers()).toBeNull();
    const putRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(putRequest?.[1]?.headers).toMatchObject({ 'If-None-Match': '*' });
  });

  it('prevents editing while the confirmed legacy import is in progress', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    const saved = preferencesResponse(true, {
      goal: 'muscle',
      pace: 'days-3',
      equipment: 'dumbbells',
    });
    let resolveWrite: (response: Response) => void = () => {
      throw new Error('Import write has not started');
    };
    const pendingWrite = new Promise<Response>((resolve) => {
      resolveWrite = resolve;
    });
    let reads = 0;
    const fetchMock = jest.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe('/api/profile/preferences');
      if (init?.method === 'PUT') {
        return pendingWrite;
      }
      reads += 1;
      return jsonResponse(reads === 3 ? saved : preferencesResponse(false));
    });
    global.fetch = fetchMock;

    render(<ProfileCoachContext />);
    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));
    await screen.findByText('Respuestas anteriores de este navegador');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    await waitFor(() => expect(fetchMock.mock.calls).toHaveLength(3));

    expect(screen.getByRole('button', { name: 'Definir preferencias' }).getAttribute('disabled')).toBe('');
    resolveWrite(jsonResponse(saved));
    expect(await screen.findByText('Las respuestas anteriores ya están guardadas en tu cuenta.')).toBeTruthy();
  });

  it('refreshes server state after a conditional import loses a 409 race', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    const fetchMock = setFetchResponses(
      jsonResponse(preferencesResponse(false)),
      jsonResponse(preferencesResponse(false)),
      jsonResponse({ code: 'CONFLICT', message: 'Ya hay preferencias guardadas.' }, 409),
      jsonResponse(preferencesResponse(true, {
        goal: 'strength',
        pace: 'days-4',
        equipment: 'bands',
      })),
    );

    render(<ProfileCoachContext />);
    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));
    await screen.findByText('Respuestas anteriores de este navegador');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));

    expect(await screen.findByText('Ganar fuerza')).toBeTruthy();
    expect(screen.getByText('4 días por semana')).toBeTruthy();
    expect(screen.getByText('Bandas elásticas')).toBeTruthy();
    expect(await screen.findByText('Ya hay preferencias guardadas en tu cuenta. No se reemplazaron con estas respuestas.')).toBeTruthy();
    expect(fetchMock.mock.calls).toHaveLength(4);
    expect(readOnboardingAnswers()).toEqual({
      goal: 'muscle',
      pace: 'days-3',
      equipment: 'dumbbells',
    });
  });

  it('retains browser answers when a confirmed import fails', async () => {
    const answers = { goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' } as const;
    saveOnboardingAnswers(answers);
    setFetchResponses(
      jsonResponse(preferencesResponse(false)),
      jsonResponse(preferencesResponse(false)),
      jsonResponse({ code: 'SERVICE_UNAVAILABLE' }, 503),
    );

    render(<ProfileCoachContext />);
    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));
    await screen.findByText('Respuestas anteriores de este navegador');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(readOnboardingAnswers()).toEqual(answers);
  });

  it('saves explicit edits with the normal authenticated PUT contract', async () => {
    const fetchMock = setFetchResponses(
      jsonResponse(preferencesResponse(true, {
        goal: 'muscle',
        pace: 'days-3',
        equipment: 'dumbbells',
      })),
      jsonResponse(preferencesResponse(true, {
        goal: 'strength',
        pace: 'days-4',
        equipment: 'bands',
      })),
    );

    render(<ProfileCoachContext />);
    await screen.findByText('Ganar músculo');
    fireEvent.click(screen.getByRole('button', { name: 'Editar preferencias' }));
    fireEvent.change(screen.getByLabelText('Objetivo personal'), { target: { value: 'strength' } });
    fireEvent.change(screen.getByLabelText('Ritmo'), { target: { value: 'days-4' } });
    fireEvent.change(screen.getByLabelText('Equipo disponible'), { target: { value: 'bands' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    expect(await screen.findByText('Ganar fuerza')).toBeTruthy();
    expect(screen.getByText('4 días por semana')).toBeTruthy();
    expect(screen.getByText('Bandas elásticas')).toBeTruthy();
    const putRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(putRequest?.[1]?.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(putRequest?.[1]?.headers).not.toHaveProperty('If-None-Match');
    expect(JSON.parse(String(putRequest?.[1]?.body))).toEqual({
      goal: 'strength',
      pace: 'days-4',
      equipment: 'bands',
    });
  });

  it('creates server preferences from the empty state only after explicit editing and save', async () => {
    const fetchMock = setFetchResponses(
      jsonResponse(preferencesResponse(false)),
      jsonResponse(preferencesResponse(true, {
        goal: 'fitness',
        pace: 'days-2',
        equipment: 'bodyweight',
      })),
    );

    render(<ProfileCoachContext />);
    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Editar objetivo personal' }));
    expect(screen.getByLabelText('Objetivo personal')).toHaveProperty('value', '');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edición' }));
    fireEvent.click(screen.getByRole('button', { name: 'Definir preferencias' }));
    fireEvent.change(screen.getByLabelText('Objetivo personal'), { target: { value: 'fitness' } });
    fireEvent.change(screen.getByLabelText('Ritmo'), { target: { value: 'days-2' } });
    fireEvent.change(screen.getByLabelText('Equipo disponible'), { target: { value: 'bodyweight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    expect(await screen.findByText('Mejorar condición física')).toBeTruthy();
    expect(screen.getByText('2 días por semana')).toBeTruthy();
    expect(screen.getByText('Peso corporal')).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('does not write invalid or absent legacy answers and allows retry after a load error', async () => {
    localStorage.setItem('atlas:onboarding:answers', JSON.stringify({
      goal: 'not-a-goal',
      pace: 'days-3',
      equipment: 'dumbbells',
    }));
    const fetchMock = setFetchResponses(
      jsonResponse(null, 500),
      jsonResponse(preferencesResponse(false)),
    );

    render(<ProfileCoachContext />);

    expect(await screen.findByText('No pudimos cargar tus preferencias. Probá de nuevo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));

    expect(await screen.findByText('No encontramos respuestas válidas para importar en este navegador.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar importación' })).toBeNull();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  });

  it('reports when legacy answers are absent without attempting an import', async () => {
    const fetchMock = setFetchResponses(jsonResponse(preferencesResponse(false)));

    render(<ProfileCoachContext />);

    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar respuestas anteriores' }));

    expect(await screen.findByText('No encontramos respuestas anteriores guardadas en este navegador.')).toBeTruthy();
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  it('reports expired authentication and makes no write when legacy data is absent', async () => {
    setFetchResponses(jsonResponse({ code: 'UNAUTHORIZED' }, 401));

    render(<ProfileCoachContext />);

    expect(await screen.findByText('Tu sesión venció. Iniciá sesión de nuevo para ver tus preferencias.')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the editor open and permits an explicit retry after a save receives 401', async () => {
    const fetchMock = setFetchResponses(
      jsonResponse(preferencesResponse(true, {
        goal: 'muscle',
        pace: 'days-3',
        equipment: 'dumbbells',
      })),
      jsonResponse({ code: 'UNAUTHORIZED' }, 401),
      jsonResponse(preferencesResponse(true, {
        goal: 'muscle',
        pace: 'days-3',
        equipment: 'dumbbells',
      })),
    );

    render(<ProfileCoachContext />);
    await screen.findByText('Ganar músculo');
    fireEvent.click(screen.getByRole('button', { name: 'Editar preferencias' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    expect(await screen.findByText('Tu sesión venció. Iniciá sesión de nuevo para guardar tus preferencias.')).toBeTruthy();
    expect(screen.getByLabelText('Objetivo personal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    expect(await screen.findByText('Preferencias guardadas.')).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2);
  });

  it('does not write preferences on mount even when a valid legacy value exists', async () => {
    saveOnboardingAnswers({ goal: 'muscle', pace: 'days-3', equipment: 'dumbbells' });
    const fetchMock = setFetchResponses(jsonResponse(preferencesResponse(false)));

    render(<ProfileCoachContext />);

    await screen.findByText('Todavía no guardaste preferencias de Coach.');
    await waitFor(() => expect(fetchMock.mock.calls).toHaveLength(1));
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Confirmar importación' })).toBeNull();
  });
});
