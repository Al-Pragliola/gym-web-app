# Gym Web App Backend

This is a simple Go backend for the Gym Web App. It uses SQLite for persistence.

## Prerequisites

- [Go](https://go.dev/doc/install) installed on your machine.

## Running the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Run the server:
   ```bash
   go run main.go
   ```
   The server will start on `http://localhost:8080`.

## API Endpoints

- `GET /api/workouts`: List all workouts.
- `POST /api/workouts`: Create a new workout.
  - Body: `{"name": "Bench Press"}`

## Frontend Integration

The Vite frontend is configured to proxy `/api` requests to `http://localhost:8080`. You can use `fetch('/api/workouts')` in your frontend code to interact with the backend.
