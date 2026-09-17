import bcrypt from 'bcryptjs';
import { db } from './client';
import { users, exercises, userStreaks } from './schema';
import { eq } from 'drizzle-orm';

const QA_USER_EMAIL = 'qa@atlas.test';
const QA_USER_PASSWORD = 'Test1234!';

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
    imageUrl: 'https://via.placeholder.com/400x300?text=Press+Banca',
    videoUrl: 'https://www.youtube.com/watch?v=bench-press-example',
    isSystem: true,
  },
  {
    slug: 'squat',
    name: 'Sentadilla',
    muscleGroup: 'Piernas',
    instructions:
      'Con la barra en los hombros, baja doblando rodillas y caderas hasta que los muslos estén paralelos al suelo.',
    imageUrl: 'https://via.placeholder.com/400x300?text=Sentadilla',
    videoUrl: 'https://www.youtube.com/watch?v=squat-example',
    isSystem: true,
  },
  {
    slug: 'deadlift',
    name: 'Peso Muerto',
    muscleGroup: 'Espalda',
    instructions:
      'Con la barra en el suelo, agáchate y levántala manteniendo la espalda recta hasta estar de pie.',
    imageUrl: 'https://via.placeholder.com/400x300?text=Peso+Muerto',
    videoUrl: 'https://www.youtube.com/watch?v=deadlift-example',
    isSystem: true,
  },
  {
    slug: 'overhead-press',
    name: 'Press Militar',
    muscleGroup: 'Hombros',
    instructions:
      'De pie, empuja la barra desde los hombros hacia arriba hasta extender completamente los brazos.',
    imageUrl: 'https://via.placeholder.com/400x300?text=Press+Militar',
    videoUrl: 'https://www.youtube.com/watch?v=overhead-press-example',
    isSystem: true,
  },
  {
    slug: 'barbell-row',
    name: 'Remo con Barra',
    muscleGroup: 'Espalda',
    instructions:
      'Inclinado hacia adelante, tira de la barra hacia tu abdomen manteniendo los codos cerca del cuerpo.',
    imageUrl: 'https://via.placeholder.com/400x300?text=Remo+con+Barra',
    videoUrl: 'https://www.youtube.com/watch?v=barbell-row-example',
    isSystem: true,
  },
];

async function seed() {
  console.log('Starting seed...');

  // Create QA user
  console.log('Creating QA user...');
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
  console.log(`  Password: ${QA_USER_PASSWORD}`);

  // Create system exercises
  console.log('\nCreating system exercises...');

  for (const exercise of SYSTEM_EXERCISES) {
    const existing = await db.query.exercises.findFirst({
      where: eq(exercises.slug, exercise.slug),
    });

    if (existing) {
      console.log(`  Exercise "${exercise.name}" (${exercise.slug}) already exists`);
    } else {
      await db.insert(exercises).values(exercise);
      console.log(`  Created exercise: ${exercise.name} (${exercise.slug})`);
    }
  }

  // Initialize user streak
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
    console.log('\nInitialized user streak record');
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('\nTest credentials:');
  console.log(`  Email: ${QA_USER_EMAIL}`);
  console.log(`  Password: ${QA_USER_PASSWORD}`);
  console.log('\nSystem exercises (slugs):');
  SYSTEM_EXERCISES.forEach((ex) => console.log(`  - ${ex.slug}: ${ex.name}`));
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
