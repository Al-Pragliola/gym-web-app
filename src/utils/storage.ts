import type { AppData, WorkoutSession, User } from '../types';

export const checkAuth = async (): Promise<User> => {
  const res = await fetch('/api/me');
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error("Failed to check auth");
  return res.json();
};

export const fetchData = async (): Promise<AppData> => {
  try {
    const res = await fetch('/api/state');
    
    if (res.status === 401) {
      throw new Error("Unauthorized");
    }

    if (!res.ok) throw new Error('Failed to fetch data');
    const data: AppData = await res.json();
    return data;
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      throw error;
    }
    console.error("Error loading data:", error);
    return {
       exercises: [],
       workouts: [],
       history: []
    };
  }
};

export const addSession = async (session: WorkoutSession): Promise<void> => {
  try {
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  } catch (error) {
    console.error("Error saving session:", error);
  }
};
