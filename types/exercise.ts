export interface ExerciseCatalogItem {
  id: number;
  slug: string;
  name: string;
  muscleGroup: string;
  instructions: string;
  imageUrl: string | null;
  videoUrl: string | null;
  isSystem: boolean;
}

export interface CreateExerciseInput {
  name: string;
  muscleGroup: string;
  instructions: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  slug?: string;
}

export interface UpdateExerciseInput {
  name?: string;
  muscleGroup?: string;
  instructions?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface UploadResponse {
  url: string;
  contentType: string;
  size: number;
  kind: 'image' | 'video';
}
