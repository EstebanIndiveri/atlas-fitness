import { STREAK_NUDGE_RULE } from '@/types/streak';
import { formatWeightKg } from '@/lib/format/weight';

export const TELEGRAM_COPY = {
  startUnlinked:
    'Hola, soy Atlas Fitness. Para vincular tu cuenta, pedí un código en Ajustes de la web y enviámelo acá.',
  startLinked: (name: string) =>
    `Hola, ${name}. Ya estás vinculado. Usá /log, /entreno, /resumen o /recordatorio.`,
  help: [
    'Comandos Atlas Fitness:',
    '/log <ejercicio> <peso_kg> <reps> — registrar una serie',
    '/entreno <ejercicio> <peso_kg> <reps> — entreno corto (serie + cerrar)',
    '/fin — cerrar el entrenamiento activo',
    '/resumen — resumen de hoy (hora Córdoba)',
    '/recordatorio — racha, tip y regla de aviso',
    'También podés enviar el código de 8 caracteres para vincular.',
  ].join('\n'),
  unlinked:
    'Primero vinculá tu cuenta. Pedí un código en Ajustes de la web y enviámelo acá.',
  linkOk: (name: string) => `Listo, ${name}. Tu Telegram quedó vinculado a Atlas Fitness.`,
  linkInvalid: 'Ese código no es válido o ya se usó. Generá uno nuevo en Ajustes.',
  linkExpired: 'Ese código venció. Pedí uno nuevo en Ajustes (válido 10 minutos).',
  linkConflict: 'Este Telegram ya está vinculado a otra cuenta.',
  logUsage:
    'Usá: /log <ejercicio> <peso_kg> <reps>\nEjemplo: /log press banca 80 10',
  logOk: (exercise: string, reps: number, weightKg: string) =>
    `Registré ${exercise}: ${reps} reps × ${formatWeightKg(weightKg)}.`,
  logExerciseNone: (query: string) =>
    `No encontré el ejercicio "${query}". Probá con Press Banca, Sentadilla o Peso Muerto.`,
  logExerciseAmbiguous: (names: string[]) =>
    `Hay varios ejercicios parecidos: ${names.join(', ')}. Sé más específico.`,
  endOk: 'Entrenamiento finalizado.',
  endNone: 'No tenés un entrenamiento activo.',
  summaryEmpty: (date: string) =>
    `Hoy (${date}, hora Córdoba) todavía no registraste entrenos.`,
  summaryHeader: (date: string, setCount: number) =>
    `Resumen de hoy (${date}, Córdoba) — ${setCount} serie(s):`,
  summarySetLine: (exercise: string, reps: number, weightKg: string) =>
    `• ${exercise}: ${reps} × ${formatWeightKg(weightKg)}`,
  summaryOpenWorkout: 'Tenés un entrenamiento abierto. Cerralo con /fin.',
  reminderRule: `Regla de recordatorio (${STREAK_NUDGE_RULE}): si ayer tuviste un día activo (entreno cerrado o ánimo) y hoy todavía no, te avisamos para no perder la racha. Zona horaria: America/Argentina/Cordoba. El cron /api/cron/streak-nudge registra el aviso una vez por día y lo envía por Telegram si tu cuenta está vinculada.`,
  reminderStreak: (current: number, longest: number) =>
    `Racha actual: ${current} día(s). Mejor racha: ${longest}.`,
  reminderTip: (body: string) => `Tip del día: ${body}`,
  reminderAtRisk:
    '⚠️ Tu racha está en riesgo. Ayer registraste actividad y hoy todavía no (hora Córdoba). Entrená o registrá el ánimo para no perderla.',
  reminderOk: 'Hoy ya registraste actividad. ¡Seguí así!',
  unknown: 'No entendí ese mensaje. Escribí /ayuda para ver los comandos.',
  finishKeyboardLabel: 'Finalizar entreno',
} as const;

export const TELEGRAM_FE_COPY = {
  bannerTitle: 'Vinculá Telegram',
  bannerBody:
    'Registrá series y pedí el resumen del día desde el chat, con la misma cuenta que la web.',
  bannerCta: 'Vincular Telegram',
  settingsTitle: 'Ajustes',
  settingsBack: 'Volver al inicio',
  linked: 'Telegram ya está vinculado a tu cuenta.',
  unlinked: 'Todavía no vinculaste Telegram.',
  generateCode: 'Generar código de vinculación',
  generating: 'Generando…',
  codeHint:
    'Enviá este código al bot de Atlas Fitness en Telegram. Vence en 10 minutos.',
  codeLabel: 'Tu código',
  loading: 'Cargando…',
  loadError: 'No pudimos cargar tu perfil. Probá de nuevo.',
} as const;
