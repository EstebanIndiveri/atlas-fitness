import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { shouldSeedQaUser } from './seed-options';
import { users, exercises, userStreaks, dailyTips, routines, routineExercises } from './schema';

const QA_USER_EMAIL = 'qa@atlas.test';
const QA_USER_PASSWORD = 'Test1234!';

/**
 * Base URL for free-exercise-db (yuhonas) demonstration images.
 * Real, stable, openly-licensed photos so exercises never ship with a placeholder.
 */
const FREE_EXERCISE_DB_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/**
 * Curated technique videos for the system exercises. Each YouTube id was verified
 * via the oEmbed check (exists, embeddable, title matches the movement) so they play
 * in-app instead of shipping as search links. User exercises are filled by the media
 * enrichment job (Gemini suggestion + oEmbed validation), never as unvalidated links.
 */
const YOUTUBE_WATCH_BASE = 'https://www.youtube.com/watch?v=';

/**
 * System exercises with fixed slugs for testing
 */
const SYSTEM_EXERCISES = [
  {
    slug: 'bench-press',
    name: 'Press Banca',
    muscleGroup: 'Pecho',
    instructions:
      'Acostado en un banco plano, baja la barra hasta el pecho y empuja hacia arriba con control.',
    imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/Barbell_Bench_Press_-_Medium_Grip/0.jpg`,
    videoUrl: `${YOUTUBE_WATCH_BASE}SCVCLChPQFY`,
    isSystem: true,
  },
  {
    slug: 'squat',
    name: 'Sentadilla',
    muscleGroup: 'Piernas',
    instructions:
      'Con la barra en los hombros, baja doblando rodillas y caderas hasta que los muslos estén paralelos al suelo.',
    imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/Barbell_Full_Squat/0.jpg`,
    videoUrl: `${YOUTUBE_WATCH_BASE}UFs6E3Ti1jg`,
    isSystem: true,
  },
  {
    slug: 'deadlift',
    name: 'Peso Muerto',
    muscleGroup: 'Espalda',
    instructions:
      'Con la barra en el suelo, agáchate y levántala manteniendo la espalda recta hasta estar de pie.',
    imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/Barbell_Deadlift/0.jpg`,
    videoUrl: `${YOUTUBE_WATCH_BASE}wYREQkVtvEc`,
    isSystem: true,
  },
  {
    slug: 'overhead-press',
    name: 'Press Militar',
    muscleGroup: 'Hombros',
    instructions:
      'De pie, empuja la barra desde los hombros hacia arriba hasta extender completamente los brazos.',
    imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/Standing_Military_Press/0.jpg`,
    videoUrl: `${YOUTUBE_WATCH_BASE}wol7Hko8RhY`,
    isSystem: true,
  },
  {
    slug: 'barbell-row',
    name: 'Remo con Barra',
    muscleGroup: 'Espalda',
    instructions:
      'Inclinado hacia adelante, tira de la barra hacia tu abdomen manteniendo los codos cerca del cuerpo.',
    imageUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}/Bent_Over_Barbell_Row/0.jpg`,
    videoUrl: `${YOUTUBE_WATCH_BASE}9efgcAjQe7E`,
    isSystem: true,
  },
];

async function exerciseIdBySlug(slug: string): Promise<number> {
  const row = await db.query.exercises.findFirst({
    where: eq(exercises.slug, slug),
  });
  if (!row) {
    throw new Error(`Seed exercise missing: ${slug}`);
  }
  return row.id;
}

async function seedRoutines(): Promise<void> {
  console.log('\nCreating system routines...');

  const benchId = await exerciseIdBySlug('bench-press');
  const squatId = await exerciseIdBySlug('squat');
  const ohpId = await exerciseIdBySlug('overhead-press');

  const templates = [
    {
      slug: 'full-body-expres',
      name: 'Full body exprés',
      description: 'Dos ejercicios, una serie cada uno. Ideal para una sesión guiada corta.',
      kind: 'gym',
      restSeconds: 30,
      items: [
        { exerciseId: benchId, sortOrder: 1, targetSets: 1, targetReps: 5 },
        { exerciseId: squatId, sortOrder: 2, targetSets: 1, targetReps: 5 },
      ],
    },
    {
      slug: 'empuje',
      name: 'Empuje',
      description: 'Press banca y press militar. Tres series.',
      kind: 'gym',
      restSeconds: 90,
      items: [
        { exerciseId: benchId, sortOrder: 1, targetSets: 3, targetReps: 8 },
        { exerciseId: ohpId, sortOrder: 2, targetSets: 3, targetReps: 10 },
      ],
    },
  ];

  for (const template of templates) {
    const existing = await db.query.routines.findFirst({
      where: eq(routines.slug, template.slug),
    });

    let routineId: number;
    if (existing) {
      routineId = existing.id;
      console.log(`  Routine "${template.name}" (${template.slug}) already exists`);
    } else {
      const [created] = await db
        .insert(routines)
        .values({
          slug: template.slug,
          name: template.name,
          description: template.description,
          kind: template.kind,
          restSeconds: template.restSeconds,
          isSystem: true,
        })
        .returning();
      routineId = created.id;
      console.log(`  Created routine: ${template.name} (${template.slug})`);
    }

    const existingItems = await db.query.routineExercises.findMany({
      where: eq(routineExercises.routineId, routineId),
    });
    if (existingItems.length > 0) {
      continue;
    }

    await db.insert(routineExercises).values(
      template.items.map((item) => ({
        routineId,
        exerciseId: item.exerciseId,
        sortOrder: item.sortOrder,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
      })),
    );
  }
}

async function seedQaAccount(): Promise<void> {
  console.log('\nCreating QA user...');
  const passwordHash = await bcrypt.hash(QA_USER_PASSWORD, 10);

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, QA_USER_EMAIL),
  });

  let userId: number;

  if (existingUser) {
    console.log('QA user already exists, updating...');
    await db
      .update(users)
      .set({ passwordHash, name: 'QA Test User' })
      .where(eq(users.id, existingUser.id));
    userId = existingUser.id;
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        name: 'QA Test User',
        email: QA_USER_EMAIL,
        passwordHash,
      })
      .returning();
    userId = newUser.id;
  }

  console.log(`QA user created/updated with ID: ${userId}`);
  console.log(`  Email: ${QA_USER_EMAIL}`);

  const existingStreak = await db.query.userStreaks.findFirst({
    where: eq(userStreaks.userId, userId),
  });

  if (!existingStreak) {
    await db.insert(userStreaks).values({
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
    });
    console.log('Initialized QA user streak record');
  }
}

async function seed() {
  console.log('Starting seed...');
  const seedQaUser = shouldSeedQaUser();

  // Create system exercises
  console.log('\nCreating system exercises...');

  for (const exercise of SYSTEM_EXERCISES) {
    const existing = await db.query.exercises.findFirst({
      where: eq(exercises.slug, exercise.slug),
    });

    if (existing) {
      await db.update(exercises).set(exercise).where(eq(exercises.id, existing.id));
      console.log(`  Updated exercise: ${exercise.name} (${exercise.slug})`);
    } else {
      await db.insert(exercises).values(exercise);
      console.log(`  Created exercise: ${exercise.name} (${exercise.slug})`);
    }
  }

  await seedRoutines();

  // Seed a few sample daily tips for testing
  console.log('\nSeeding sample daily tips...');
  const sampleTips = [
    {
      date: '2026-09-16',
      body: 'La constancia es la clave. Cada entrenamiento cuenta, no importa cuán pequeño sea.',
      source: 'system',
    },
    {
      date: '2026-09-15',
      body: 'Recordá: el dolor que sentís hoy será la fuerza que sentirás mañana.',
      source: 'system',
    },
  ];

  for (const tip of sampleTips) {
    const existing = await db.query.dailyTips.findFirst({
      where: eq(dailyTips.date, tip.date),
    });

    if (!existing) {
      await db.insert(dailyTips).values(tip);
      console.log(`  Created tip for ${tip.date}`);
    } else {
      console.log(`  Tip for ${tip.date} already exists`);
    }
  }

  if (seedQaUser) {
    await seedQaAccount();
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('\nSystem exercises (slugs):');
  SYSTEM_EXERCISES.forEach((ex) => console.log(`  - ${ex.slug}: ${ex.name}`));
  console.log('\nSystem routines (slugs):');
  console.log('  - full-body-expres: Full body exprés');
  console.log('  - empuje: Empuje');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
