import { FREE_EXERCISE_DB_IMAGE_BASE } from '@/lib/exercises/catalog/free-exercise-db';
export type SystemExerciseSeed = {
  slug: string;
  name: string;
  muscleGroup: string;
  instructions: string;
  imageUrl: string;
  videoUrl: string | null;
  isSystem: true;
};
/** Minimum production catalog size expected by seed and migration tests. */
export const SYSTEM_EXERCISE_MIN_COUNT = 40;

const YOUTUBE_WATCH_BASE = 'https://www.youtube.com/watch?v=';

function image(path: string): string {
  return `${FREE_EXERCISE_DB_IMAGE_BASE}/${path}`;
}

/**
 * Curated es-AR system catalog backed by real free-exercise-db images.
 * Videos are only present when previously oEmbed-validated; missing videos stay null for enrichment.
 */
export const SYSTEM_EXERCISES = [
  { slug: 'bench-press', name: 'Press Banca', muscleGroup: 'Pecho', instructions: 'Acostado en banco plano, bajá la barra al pecho y empujá con control.', imageUrl: image('Barbell_Bench_Press_-_Medium_Grip/0.jpg'), videoUrl: `${YOUTUBE_WATCH_BASE}SCVCLChPQFY`, isSystem: true },
  { slug: 'squat', name: 'Sentadilla', muscleGroup: 'Piernas', instructions: 'Con la barra firme, bajá cadera y rodillas hasta una profundidad cómoda y subí estable.', imageUrl: image('Barbell_Full_Squat/0.jpg'), videoUrl: `${YOUTUBE_WATCH_BASE}UFs6E3Ti1jg`, isSystem: true },
  { slug: 'deadlift', name: 'Peso Muerto', muscleGroup: 'Espalda', instructions: 'Desde el piso, empujá el suelo y extendé cadera manteniendo la espalda neutra.', imageUrl: image('Barbell_Deadlift/0.jpg'), videoUrl: `${YOUTUBE_WATCH_BASE}wYREQkVtvEc`, isSystem: true },
  { slug: 'overhead-press', name: 'Press Militar', muscleGroup: 'Hombros', instructions: 'De pie, llevá la barra desde hombros hasta arriba sin arquear la espalda.', imageUrl: image('Standing_Military_Press/0.jpg'), videoUrl: `${YOUTUBE_WATCH_BASE}wol7Hko8RhY`, isSystem: true },
  { slug: 'barbell-row', name: 'Remo con Barra', muscleGroup: 'Espalda', instructions: 'Inclinate con torso firme y llevá la barra hacia el abdomen con codos atrás.', imageUrl: image('Bent_Over_Barbell_Row/0.jpg'), videoUrl: `${YOUTUBE_WATCH_BASE}9efgcAjQe7E`, isSystem: true },
  { slug: 'incline-dumbbell-press', name: 'Press inclinado con mancuernas', muscleGroup: 'Pecho', instructions: 'En banco inclinado, bajá las mancuernas al pecho alto y empujá sin rebotar.', imageUrl: image('Incline_Dumbbell_Press/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'dumbbell-fly', name: 'Aperturas con mancuernas', muscleGroup: 'Pecho', instructions: 'Con codos apenas flexionados, abrí los brazos y cerrá sintiendo el pecho.', imageUrl: image('Dumbbell_Flyes/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'push-up', name: 'Flexiones de brazos', muscleGroup: 'Pecho', instructions: 'Desde plancha, bajá el pecho hacia el piso y empujá manteniendo el cuerpo alineado.', imageUrl: image('Pushups/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'cable-fly', name: 'Cruce de poleas', muscleGroup: 'Pecho', instructions: 'Con poleas abiertas, juntá las manos delante del pecho y volvé controlado.', imageUrl: image('Flat_Bench_Cable_Flyes/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'chest-dip', name: 'Fondos para pecho', muscleGroup: 'Pecho', instructions: 'Inclinate levemente, bajá con control y empujá usando pecho y tríceps.', imageUrl: image('Dips_-_Chest_Version/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'pull-up', name: 'Dominadas', muscleGroup: 'Espalda', instructions: 'Colgado de la barra, llevá el pecho hacia arriba y bajá hasta extender brazos.', imageUrl: image('Pullups/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'lat-pulldown', name: 'Jalón al pecho', muscleGroup: 'Espalda', instructions: 'Tirá la barra hacia el pecho con hombros bajos y controlá la subida.', imageUrl: image('Close-Grip_Front_Lat_Pulldown/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'seated-cable-row', name: 'Remo sentado en polea', muscleGroup: 'Espalda', instructions: 'Sentado, tirá el agarre hacia el abdomen juntando escápulas sin balancearte.', imageUrl: image('Seated_Cable_Rows/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'one-arm-dumbbell-row', name: 'Remo a una mano', muscleGroup: 'Espalda', instructions: 'Apoyado en banco, llevá la mancuerna a la cadera y bajá con recorrido completo.', imageUrl: image('One-Arm_Dumbbell_Row/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'face-pull', name: 'Face pull', muscleGroup: 'Hombros', instructions: 'Tirá la cuerda hacia la cara con codos altos para activar deltoides posteriores.', imageUrl: image('Face_Pull/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'dumbbell-shoulder-press', name: 'Press de hombros con mancuernas', muscleGroup: 'Hombros', instructions: 'Desde hombros, empujá las mancuernas arriba y bajá sin perder postura.', imageUrl: image('Dumbbell_Shoulder_Press/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'lateral-raise', name: 'Elevaciones laterales', muscleGroup: 'Hombros', instructions: 'Elevá las mancuernas hasta la línea de hombros con codos suaves y sin impulso.', imageUrl: image('Seated_Side_Lateral_Raise/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'rear-delt-fly', name: 'Pájaros para deltoides posterior', muscleGroup: 'Hombros', instructions: 'Inclinado, abrí los brazos hacia los lados juntando escápulas con control.', imageUrl: image('Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'front-squat', name: 'Sentadilla frontal', muscleGroup: 'Piernas', instructions: 'Con la barra al frente, bajá vertical y subí manteniendo codos altos.', imageUrl: image('Front_Squat_Clean_Grip/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'leg-press', name: 'Prensa de piernas', muscleGroup: 'Piernas', instructions: 'Empujá la plataforma sin bloquear rodillas y bajá hasta una profundidad segura.', imageUrl: image('Leg_Press/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'dumbbell-lunge', name: 'Estocadas con mancuernas', muscleGroup: 'Piernas', instructions: 'Da un paso largo, bajá ambas rodillas y volvé empujando con la pierna delantera.', imageUrl: image('Dumbbell_Lunges/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'leg-extension', name: 'Extensión de cuádriceps', muscleGroup: 'Piernas', instructions: 'Extendé las rodillas en la máquina, pausá arriba y bajá con control.', imageUrl: image('Leg_Extensions/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'lying-leg-curl', name: 'Curl femoral acostado', muscleGroup: 'Piernas', instructions: 'Flexioná rodillas llevando talones hacia glúteos y volvé lento.', imageUrl: image('Lying_Leg_Curls/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'standing-calf-raise', name: 'Elevación de gemelos de pie', muscleGroup: 'Piernas', instructions: 'Subí talones al máximo, pausá y bajá hasta sentir estiramiento en gemelos.', imageUrl: image('Standing_Calf_Raises/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'hip-thrust', name: 'Hip thrust', muscleGroup: 'Glúteos', instructions: 'Con espalda en banco, extendé cadera empujando talones y apretá glúteos arriba.', imageUrl: image('Barbell_Hip_Thrust/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'glute-bridge', name: 'Puente de glúteos', muscleGroup: 'Glúteos', instructions: 'Acostado, elevá la cadera apretando glúteos y bajá sin perder control.', imageUrl: image('Barbell_Glute_Bridge/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'romanian-deadlift', name: 'Peso muerto rumano', muscleGroup: 'Glúteos', instructions: 'Llevá la cadera atrás con rodillas suaves y subí extendiendo isquios y glúteos.', imageUrl: image('Romanian_Deadlift/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'bulgarian-split-squat', name: 'Sentadilla búlgara', muscleGroup: 'Glúteos', instructions: 'Con un pie atrás elevado, bajá vertical y empujá con la pierna delantera.', imageUrl: image('Split_Squat_with_Dumbbells/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'goblet-squat', name: 'Sentadilla goblet', muscleGroup: 'Piernas', instructions: 'Sostené una mancuerna al pecho, bajá cómodo y subí manteniendo torso firme.', imageUrl: image('Goblet_Squat/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'kettlebell-swing', name: 'Swing con kettlebell', muscleGroup: 'Glúteos', instructions: 'Hacé bisagra de cadera y proyectá la pesa al frente con potencia de glúteos.', imageUrl: image('One-Arm_Kettlebell_Swings/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'barbell-curl', name: 'Curl con barra', muscleGroup: 'Bíceps', instructions: 'Flexioná codos llevando la barra hacia el pecho sin balancear el torso.', imageUrl: image('Barbell_Curl/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'hammer-curl', name: 'Curl martillo', muscleGroup: 'Bíceps', instructions: 'Con agarre neutro, subí las mancuernas y bajá lento manteniendo codos cerca.', imageUrl: image('Hammer_Curls/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'preacher-curl', name: 'Curl predicador', muscleGroup: 'Bíceps', instructions: 'Apoyá brazos en el banco predicador, flexioná y extendé sin despegar codos.', imageUrl: image('Cable_Preacher_Curl/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'triceps-pushdown', name: 'Extensión de tríceps en polea', muscleGroup: 'Tríceps', instructions: 'Empujá la cuerda hacia abajo extendiendo codos y volvé sin mover hombros.', imageUrl: image('Triceps_Pushdown/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'bench-dip', name: 'Fondos en banco', muscleGroup: 'Tríceps', instructions: 'Con manos en banco, bajá flexionando codos y empujá hasta extenderlos.', imageUrl: image('Bench_Dips/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'skullcrusher', name: 'Rompecráneos con barra Z', muscleGroup: 'Tríceps', instructions: 'Acostado, flexioná codos hacia la frente y extendé sin abrir los brazos.', imageUrl: image('EZ-Bar_Skullcrusher/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'plank', name: 'Plancha', muscleGroup: 'Core', instructions: 'Sostené el cuerpo alineado sobre antebrazos, respirando sin hundir la cadera.', imageUrl: image('Plank/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'crunch', name: 'Crunch abdominal', muscleGroup: 'Core', instructions: 'Elevá hombros del piso llevando costillas hacia pelvis, sin tirar del cuello.', imageUrl: image('Crunches/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'hanging-leg-raise', name: 'Elevación de piernas colgado', muscleGroup: 'Core', instructions: 'Colgado de la barra, elevá piernas con abdomen firme y bajá controlado.', imageUrl: image('Hanging_Leg_Raise/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'russian-twist', name: 'Giros rusos', muscleGroup: 'Core', instructions: 'Sentado, rotá el torso de lado a lado manteniendo abdomen activo.', imageUrl: image('Cable_Russian_Twists/0.jpg'), videoUrl: null, isSystem: true },
  { slug: 'mountain-climber', name: 'Escaladores', muscleGroup: 'Core', instructions: 'En plancha alta, llevá rodillas alternadas al pecho sin perder alineación.', imageUrl: image('Mountain_Climbers/0.jpg'), videoUrl: null, isSystem: true },
] as const satisfies readonly SystemExerciseSeed[];
