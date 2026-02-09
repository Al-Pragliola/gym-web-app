export interface User {
  id: string;
  email: string;
  name: string;
  google_id: string;
}

export interface ExerciseDef {
  id: string;
  userId: string;
  name: string;
}

export interface WorkoutDayExercise {
  id: string;
  dayId: string;
  exerciseId: string;
  name: string; // Joined from ExerciseDef
  targetSets: number;
  targetReps: string;
  order: number;
  alternatives?: ExerciseDef[];
}

export interface WorkoutDay {
  id: string;
  workoutId: string;
  name: string;
  order: number;
  exercises: WorkoutDayExercise[];
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  days: WorkoutDay[];
}

export interface WorkoutSet {
  weight: number;
  reps: number;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: string;
  routineName?: string; // Optional for backward compatibility
  dayName: string;
  logs: ExerciseLog[];
  userId: string;
}

export interface AppData {
  user?: User;
  exercises: ExerciseDef[];
  workouts: Workout[];
  history: WorkoutSession[];
  // Legacy compatibility: mapped from first workout's days if needed, but let's try to use workouts directly
}

// Helper types for UI
export interface Day extends WorkoutDay {} // Alias for compatibility during refactor
export interface Exercise extends WorkoutDayExercise {} // Alias

