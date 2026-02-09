package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	_ "modernc.org/sqlite"
)

var (
	db          *sql.DB
	oauthConfig *oauth2.Config
	store       *sessions.CookieStore
)

// --- Domain Models ---

type User struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	GoogleID string `json:"google_id"`
}

// ExerciseDef represents a global exercise in the library
type ExerciseDef struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	Name   string `json:"name"`
}

// Workout (Program) represents a collection of days (e.g., "PPL Split")
type Workout struct {
	ID     string       `json:"id"`
	UserID string       `json:"userId"`
	Name   string       `json:"name"`
	Days   []WorkoutDay `json:"days"`
}

// WorkoutDay represents a specific day within a workout (e.g., "Push Day")
type WorkoutDay struct {
	ID        string               `json:"id"`
	WorkoutID string               `json:"workoutId"`
	Name      string               `json:"name"`
	Order     int                  `json:"order"`
	Exercises []WorkoutDayExercise `json:"exercises"`
}

// WorkoutDayExercise links an ExerciseDef to a Day with specific targets
type WorkoutDayExercise struct {
	ID         string `json:"id"`
	DayID      string `json:"dayId"`
	ExerciseID string `json:"exerciseId"`
	// We include the name here for convenience in the frontend, joined from ExerciseDef
	Name       string        `json:"name"` 
	TargetSets int           `json:"targetSets"`
	TargetReps string        `json:"targetReps"`
	Order      int           `json:"order"`
	Alternatives []ExerciseDef `json:"alternatives"`
}

// For history/logging (keeping similar to before but adapted)
type WorkoutSet struct {
	Weight float64 `json:"weight"`
	Reps   int     `json:"reps"`
}

type ExerciseLog struct {
	ExerciseID   string       `json:"exerciseId"`
	ExerciseName string       `json:"exerciseName"`
	Sets         []WorkoutSet `json:"sets"`
}

type WorkoutSession struct {
	ID          string        `json:"id"`
	Date        string        `json:"date"`
	RoutineName string        `json:"routineName"` // New field
	DayName     string        `json:"dayName"`
	Logs        []ExerciseLog `json:"logs"`
	UserID      string        `json:"userId"`
}

type AppData struct {
	User      *User          `json:"user,omitempty"`
	Exercises []ExerciseDef  `json:"exercises"`
	Workouts  []Workout      `json:"workouts"`
	History   []WorkoutSession `json:"history"`
}

func main() {
	// Setup OAuth
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = "http://localhost:8080/auth/google/callback"
	}
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		sessionSecret = "super-secret-key-please-change"
	}

	if clientID == "" || clientSecret == "" {
		log.Println("Warning: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Auth will fail.")
	}

	oauthConfig = &oauth2.Config{
		RedirectURL:  redirectURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}

	store = sessions.NewCookieStore([]byte(sessionSecret))
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 30, // 30 days
		HttpOnly: true,
		Secure:   os.Getenv("GO_ENV") == "production", // Secure in prod
	}

	var err error
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./gym.db"
	}
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := initDB(); err != nil {
		log.Fatal(err)
	}

	// Auth Routes
	http.HandleFunc("/auth/google/login", handleGoogleLogin)
	http.HandleFunc("/auth/google/callback", handleGoogleCallback)
	http.HandleFunc("/auth/logout", handleLogout)
	http.HandleFunc("/api/me", withLogging(requireAuth(handleMe)))

	// Data Routes
	http.HandleFunc("/api/state", withLogging(requireAuth(handleState)))
	http.HandleFunc("/api/exercises", withLogging(requireAuth(handleExercises)))
	http.HandleFunc("/api/workouts", withLogging(requireAuth(handleWorkouts))) 
	http.HandleFunc("/api/session", withLogging(requireAuth(handleSession)))

	// Serve Frontend (SPA Handler)
	// This catches everything else and serves index.html if file doesn't exist
	fs := http.FileServer(http.Dir("./dist"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If it's an API route that wasn't matched above, let it 404 (handled by DefaultServeMux? No, "/" matches all)
		// actually "/" matches all. We need to be careful.
		// If the path starts with /api/ or /auth/, and we are here, it means it wasn't matched by the specific handlers above.
		// So we should return 404.
		path := r.URL.Path
		if len(path) >= 4 && (path[:4] == "/api" || path[:5] == "/auth") {
			http.NotFound(w, r)
			return
		}

		// Check if file exists in dist
		if _, err := os.Stat("./dist" + path); os.IsNotExist(err) {
			// File not found, serve index.html for SPA routing
			http.ServeFile(w, r, "./dist/index.html")
			return
		}
		// Serve static file
		fs.ServeHTTP(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func initDB() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE,
			name TEXT,
			google_id TEXT UNIQUE
		)`,
		`CREATE TABLE IF NOT EXISTS exercises (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			name TEXT,
			UNIQUE(user_id, name)
		)`,
		`CREATE TABLE IF NOT EXISTS workouts (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			name TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS workout_days (
			id TEXT PRIMARY KEY,
			workout_id TEXT,
			name TEXT,
			day_order INTEGER
		)`,
		`CREATE TABLE IF NOT EXISTS workout_day_exercises (
			id TEXT PRIMARY KEY,
			day_id TEXT,
			exercise_id TEXT,
			target_sets INTEGER,
			target_reps TEXT,
			ex_order INTEGER
		)`,
		`CREATE TABLE IF NOT EXISTS workout_day_exercise_alternatives (
			id TEXT PRIMARY KEY,
			workout_day_exercise_id TEXT,
			exercise_id TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY, 
			date TEXT, 
			data TEXT, 
			user_id TEXT
		)`,
		// Legacy table, keep for reference or migration
		`CREATE TABLE IF NOT EXISTS user_settings (
			user_id TEXT,
			key TEXT,
			value TEXT,
			PRIMARY KEY (user_id, key)
		)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}

	return nil
}

// --- Handlers ---

func handleState(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	// 1. Fetch User
	var user User
	err := db.QueryRow("SELECT id, email, name, google_id FROM users WHERE id = ?", userID).Scan(
		&user.ID, &user.Email, &user.Name, &user.GoogleID,
	)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// 2. Migration Check: If no workouts exist but legacy days do, migrate them
	migrateLegacyData(userID)

	// 3. Fetch Exercises
	exercises := []ExerciseDef{}
	rows, err := db.Query("SELECT id, user_id, name FROM exercises WHERE user_id = ? ORDER BY name", userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var ex ExerciseDef
		rows.Scan(&ex.ID, &ex.UserID, &ex.Name)
		exercises = append(exercises, ex)
	}

	// 4. Fetch Workouts -> Days -> Exercises
	workouts := []Workout{}
	wRows, err := db.Query("SELECT id, user_id, name FROM workouts WHERE user_id = ?", userID)
	if err == nil {
		defer wRows.Close()
		for wRows.Next() {
			var wk Workout
			wRows.Scan(&wk.ID, &wk.UserID, &wk.Name)
			
			// Fetch Days for this Workout
			dRows, err := db.Query("SELECT id, workout_id, name, day_order FROM workout_days WHERE workout_id = ? ORDER BY day_order", wk.ID)
			if err == nil {
				days := []WorkoutDay{}
				for dRows.Next() {
					var wd WorkoutDay
					dRows.Scan(&wd.ID, &wd.WorkoutID, &wd.Name, &wd.Order)
					
					// Fetch Exercises for this Day
					eRows, err := db.Query(`
						SELECT wde.id, wde.day_id, wde.exercise_id, e.name, wde.target_sets, wde.target_reps, wde.ex_order
						FROM workout_day_exercises wde
						JOIN exercises e ON wde.exercise_id = e.id
						WHERE wde.day_id = ?
						ORDER BY wde.ex_order
					`, wd.ID)
					if err == nil {
						dayExs := []WorkoutDayExercise{}
						for eRows.Next() {
							var wde WorkoutDayExercise
							eRows.Scan(&wde.ID, &wde.DayID, &wde.ExerciseID, &wde.Name, &wde.TargetSets, &wde.TargetReps, &wde.Order)
							
							// Fetch Alternatives for this Exercise
							altRows, err := db.Query(`
								SELECT e.id, e.user_id, e.name 
								FROM workout_day_exercise_alternatives wdea
								JOIN exercises e ON wdea.exercise_id = e.id
								WHERE wdea.workout_day_exercise_id = ?
							`, wde.ID)
							
							alts := []ExerciseDef{}
							if err == nil {
								for altRows.Next() {
									var alt ExerciseDef
									altRows.Scan(&alt.ID, &alt.UserID, &alt.Name)
									alts = append(alts, alt)
								}
								altRows.Close()
							}
							wde.Alternatives = alts
							
							dayExs = append(dayExs, wde)
						}
						eRows.Close()
						wd.Exercises = dayExs
					}
					days = append(days, wd)
				}
				dRows.Close()
				wk.Days = days
			}
			workouts = append(workouts, wk)
		}
	}

	// 5. Fetch History
	sessRows, err := db.Query("SELECT data FROM sessions WHERE user_id = ? ORDER BY date DESC", userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer sessRows.Close()
	history := []WorkoutSession{}
	for sessRows.Next() {
		var sessionData string
		if sessRows.Scan(&sessionData) == nil {
			var session WorkoutSession
			json.Unmarshal([]byte(sessionData), &session)
			history = append(history, session)
		}
	}

	resp := AppData{
		User:      &user,
		Exercises: exercises,
		Workouts:  workouts,
		History:   history,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleExercises(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	if r.Method == "POST" {
		var ex ExerciseDef
		if err := json.NewDecoder(r.Body).Decode(&ex); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		
		if ex.ID == "" {
			ex.ID = uuid.New().String()
		}
		ex.UserID = userID

		_, err := db.Exec("INSERT OR REPLACE INTO exercises (id, user_id, name) VALUES (?, ?, ?)", ex.ID, ex.UserID, ex.Name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ex)
		return
	}
	
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleWorkouts(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Expecting a full Workout object to save (Upsert)
	var wk Workout
	if err := json.NewDecoder(r.Body).Decode(&wk); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Transaction time
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 1. Save Workout
	if wk.ID == "" {
		wk.ID = uuid.New().String()
	}
	wk.UserID = userID
	_, err = tx.Exec("INSERT OR REPLACE INTO workouts (id, user_id, name) VALUES (?, ?, ?)", wk.ID, wk.UserID, wk.Name)
	if err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Handle Days (Clean and Re-insert approach)
	
	// A. Get Day IDs for cleanup
	rows, _ := tx.Query("SELECT id FROM workout_days WHERE workout_id = ?", wk.ID)
	var dayIDs []interface{}
	for rows.Next() {
		var did string
		rows.Scan(&did)
		dayIDs = append(dayIDs, did)
	}
	rows.Close()
	
	// B. Cleanup Exercises and Alternatives for those days
	if len(dayIDs) > 0 {
		placeholders := ""
		for i := 0; i < len(dayIDs); i++ {
			if i > 0 { placeholders += "," }
			placeholders += "?"
		}
		
		// First get the workout_day_exercise_ids to clean up alternatives
		exRows, _ := tx.Query("SELECT id FROM workout_day_exercises WHERE day_id IN ("+placeholders+")", dayIDs...)
		var exIDs []interface{}
		for exRows.Next() {
			var eid string
			exRows.Scan(&eid)
			exIDs = append(exIDs, eid)
		}
		exRows.Close()
		
		if len(exIDs) > 0 {
			exPlaceholders := ""
			for i := 0; i < len(exIDs); i++ {
				if i > 0 { exPlaceholders += "," }
				exPlaceholders += "?"
			}
			_, err = tx.Exec("DELETE FROM workout_day_exercise_alternatives WHERE workout_day_exercise_id IN ("+exPlaceholders+")", exIDs...)
			if err != nil {
				tx.Rollback()
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		// Now delete the exercises
		_, err = tx.Exec("DELETE FROM workout_day_exercises WHERE day_id IN ("+placeholders+")", dayIDs...)
		if err != nil {
			tx.Rollback()
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	
	// C. Delete Days
	_, err = tx.Exec("DELETE FROM workout_days WHERE workout_id = ?", wk.ID)
	if err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// D. Insert new Days & Exercises & Alternatives
	for i, day := range wk.Days {
		if day.ID == "" { day.ID = uuid.New().String() }
		_, err = tx.Exec("INSERT INTO workout_days (id, workout_id, name, day_order) VALUES (?, ?, ?, ?)", day.ID, wk.ID, day.Name, i)
		if err != nil {
			tx.Rollback()
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		
		for j, ex := range day.Exercises {
			if ex.ID == "" { ex.ID = uuid.New().String() }
			_, err = tx.Exec("INSERT INTO workout_day_exercises (id, day_id, exercise_id, target_sets, target_reps, ex_order) VALUES (?, ?, ?, ?, ?, ?)",
				ex.ID, day.ID, ex.ExerciseID, ex.TargetSets, ex.TargetReps, j)
			if err != nil {
				tx.Rollback()
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			
			// Save Alternatives
			for _, alt := range ex.Alternatives {
				altID := uuid.New().String()
				_, err = tx.Exec("INSERT INTO workout_day_exercise_alternatives (id, workout_day_exercise_id, exercise_id) VALUES (?, ?, ?)",
					altID, ex.ID, alt.ID)
				if err != nil {
					tx.Rollback()
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
			}
		}
	}

	tx.Commit()
	
	// Return updated structure
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wk)
}

func handleSession(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var session WorkoutSession
	if err := json.NewDecoder(r.Body).Decode(&session); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sessionBytes, err := json.Marshal(session)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = db.Exec("INSERT OR REPLACE INTO sessions (id, date, data, user_id) VALUES (?, ?, ?, ?)", 
		session.ID, session.Date, string(sessionBytes), userID)
	
	if err != nil {
		log.Printf("Error saving session: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// Helper: Migrate old JSON data to new Tables
func migrateLegacyData(userID string) {
	// Check if user has workouts
	var count int
	db.QueryRow("SELECT COUNT(*) FROM workouts WHERE user_id = ?", userID).Scan(&count)
	if count > 0 {
		return // Already has data
	}

	// Check for legacy days
	var daysJSON string
	err := db.QueryRow("SELECT value FROM user_settings WHERE user_id = ? AND key = 'days'", userID).Scan(&daysJSON)
	if err != nil {
		return // No legacy data
	}

	// Structs for legacy parsing
	type LegacyExercise struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		TargetSets int    `json:"targetSets"`
		TargetReps string `json:"targetReps"`
	}
	type LegacyDay struct {
		ID        string           `json:"id"`
		Name      string           `json:"name"`
		Exercises []LegacyExercise `json:"exercises"`
	}
	var legacyDays []LegacyDay
	if err := json.Unmarshal([]byte(daysJSON), &legacyDays); err != nil {
		return
	}

	// Begin Migration
	tx, _ := db.Begin()

	// 1. Create Default Workout
	workoutID := uuid.New().String()
	tx.Exec("INSERT INTO workouts (id, user_id, name) VALUES (?, ?, ?)", workoutID, userID, "Default Routine")

	// 2. Process Days
	for i, d := range legacyDays {
		dayID := d.ID // Keep ID if possible, or uuid.New().String() if format changes. Legacy IDs were strings, so ok.
		tx.Exec("INSERT INTO workout_days (id, workout_id, name, day_order) VALUES (?, ?, ?, ?)", dayID, workoutID, d.Name, i)

		// 3. Process Exercises
		for j, ex := range d.Exercises {
			// A. Ensure Exercise exists in global library
			// We try to find existing exercise by name for this user, or create new
			var exID string
			err := tx.QueryRow("SELECT id FROM exercises WHERE user_id = ? AND name = ?", userID, ex.Name).Scan(&exID)
			if err != nil {
				// Create new
				exID = ex.ID // Try to keep ID
				// Check if ID collision? uuid is safer.
				exID = uuid.New().String()
				tx.Exec("INSERT INTO exercises (id, user_id, name) VALUES (?, ?, ?)", exID, userID, ex.Name)
			}

			// B. Link to Day
			linkID := uuid.New().String()
			tx.Exec("INSERT INTO workout_day_exercises (id, day_id, exercise_id, target_sets, target_reps, ex_order) VALUES (?, ?, ?, ?, ?, ?)",
				linkID, dayID, exID, ex.TargetSets, ex.TargetReps, j)
		}
	}

	tx.Commit()
	log.Printf("Migrated legacy data for user %s", userID)
}

// Middleware
func withLogging(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next(w, r)
		log.Printf("%s %s %s %v", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
	}
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)
		if r.Method == "OPTIONS" {
			return
		}

		session, _ := store.Get(r, "gym-session")
		userID, ok := session.Values["user_id"].(string)
		if !ok || userID == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "user_id", userID)
		next(w, r.WithContext(ctx))
	}
}

func handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	url := oauthConfig.AuthCodeURL("state-token", oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	token, err := oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "Failed to exchange token", http.StatusInternalServerError)
		return
	}

	client := oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var googleUser struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		http.Error(w, "Failed to decode user info", http.StatusInternalServerError)
		return
	}

	_, err = db.Exec(`INSERT INTO users (id, email, name, google_id) 
		VALUES (?, ?, ?, ?) 
		ON CONFLICT(email) DO UPDATE SET name=excluded.name, google_id=excluded.google_id`,
		googleUser.ID, googleUser.Email, googleUser.Name, googleUser.ID)
	
	if err != nil {
		log.Printf("Error saving user: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	session, _ := store.Get(r, "gym-session")
	session.Values["user_id"] = googleUser.ID
	session.Save(r, w)

	http.Redirect(w, r, "http://localhost:5173/", http.StatusTemporaryRedirect)
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "gym-session")
	session.Options.MaxAge = -1
	session.Save(r, w)
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	
	var user User
	err := db.QueryRow("SELECT id, email, name, google_id FROM users WHERE id = ?", userID).Scan(
		&user.ID, &user.Email, &user.Name, &user.GoogleID,
	)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func enableCors(w http.ResponseWriter) {
	origin := os.Getenv("ALLOWED_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
}