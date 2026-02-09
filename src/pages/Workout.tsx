import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Form, Table, Dropdown } from 'react-bootstrap';
import { fetchData, addSession } from '../utils/storage';
import type { Day, ExerciseLog, WorkoutSet, WorkoutSession, AppData, WorkoutDayExercise } from '../types';
import { Plus, Trash2, CheckCircle, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';

import RestTimer from '../components/RestTimer';

const Workout = () => {
  const { dayId } = useParams<{ dayId: string }>();
  const navigate = useNavigate();
  const [day, setDay] = useState<Day | null>(null);
  const [routineName, setRoutineName] = useState<string>(''); // Store routine name
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  // Default to today's date, formatted as YYYY-MM-DD for the input
  const [workoutDate, setWorkoutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [exerciseMemory, setExerciseMemory] = useState<Record<string, ExerciseLog>>({});

  useEffect(() => {
    fetchData().then(data => {
      setHistory(data.history);
      
      // Find day in workouts
      let selectedDay: Day | null = null;
      let foundRoutineName = '';
      
      for (const w of data.workouts) {
         const found = w.days.find(d => d.id === dayId);
         if (found) {
            selectedDay = found;
            foundRoutineName = w.name;
            break;
         }
      }

      if (selectedDay) {
        setDay(selectedDay);
        setRoutineName(foundRoutineName);
        loadSessionOrTemplate(selectedDay, foundRoutineName, workoutDate, data.history);
      }
    });
  }, [dayId]);

  // Reload session when date changes (if day is already loaded)
  useEffect(() => {
    if (day) {
      loadSessionOrTemplate(day, routineName, workoutDate, history);
    }
  }, [workoutDate]);

  const loadSessionOrTemplate = (currentDay: Day, currentRoutineName: string, dateStr: string, currentHistory: WorkoutSession[]) => {
    // Find if ANY session exists for this date, regardless of dayName
    const existingSession = currentHistory.find(s => {
      const sDate = s.date.split('T')[0];
      return sDate === dateStr;
    });

    if (existingSession) {
      console.log("Found existing session for date:", existingSession.id, "Type:", existingSession.dayName);
      setSessionId(existingSession.id);

      // If the existing session is for a different Day type, overwrite (load fresh template)
      if (existingSession.dayName !== currentDay.name) {
        setLogs(currentDay.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.name,
          sets: Array.from({ length: ex.targetSets }, () => ({ weight: 0, reps: 0 }))
        })));
        return;
      }

      // If it's the SAME day type, merge logs to allow editing
      const mergedLogs = currentDay.exercises.map(ex => {
        // Try to find a log that matches this exercise OR any of its alternatives
        const potentialIds = [ex.exerciseId, ...(ex.alternatives?.map(a => a.id) || [])];
        
        // Find log where exerciseId matches any of the potential IDs (primary or alternatives)
        const foundLog = existingSession.logs.find(l => potentialIds.includes(l.exerciseId));
        
        // Fallback: match by name (legacy)
        const foundLogByName = existingSession.logs.find(l => l.exerciseName === ex.name);
        
        const validLog = foundLog || foundLogByName;

        if (validLog) {
          return validLog;
        }
        return {
          exerciseId: ex.exerciseId, // Make sure we use the underlying ExerciseDef ID
          exerciseName: ex.name,
          sets: Array.from({ length: ex.targetSets }, () => ({ weight: 0, reps: 0 }))
        };
      });
      setLogs(mergedLogs);

    } else {
      // No existing session for this specific date
      console.log(`No existing session for date. Searching history... Routine: "${currentRoutineName}", Day: "${currentDay.name}", History: ${currentHistory.length}`);
      setSessionId(null);

      // Find the LAST time this specific Day of this Routine was performed
      const lastSession = currentHistory.find(s => {
        // Match if names match OR if history item has no name (legacy fallback)
        // We assume if dayName matches and it's legacy data, it's relevant enough to prefill.
        const isRoutineMatch = s.routineName === currentRoutineName || !s.routineName;
        const isDayMatch = s.dayName === currentDay.name;
        const isNotToday = s.date.split('T')[0] !== dateStr;
        
        console.log(`Checking session ${s.date}: RoutineMatch=${isRoutineMatch} (${s.routineName} vs ${currentRoutineName}), DayMatch=${isDayMatch} (${s.dayName}), NotToday=${isNotToday}`);
        
        return isRoutineMatch && isDayMatch && isNotToday;
      });

      if (lastSession) {
         console.log("Prefilling from last session:", lastSession.date, "ID:", lastSession.id);
         const prefilledLogs = currentDay.exercises.map(ex => {
            // Find matching log in the last session
            // Try ID match first, then Name match
            const prevLog = lastSession.logs.find(l => 
               l.exerciseId === ex.exerciseId || // Direct match
               l.exerciseName === ex.name || // Legacy name match
               (ex.alternatives && ex.alternatives.some(a => a.id === l.exerciseId)) // Alt match
            );

            if (prevLog) {
               // Map previous sets to current target sets
               // If target is 3 sets, and we did 3 sets last time, copy all 3.
               // If we did 2 last time, copy 2 and leave 3rd empty.
               const newSets = Array.from({ length: ex.targetSets }, (_, i) => {
                  if (i < prevLog.sets.length) {
                     return { ...prevLog.sets[i] }; // Copy weight/reps
                  }
                  return { weight: 0, reps: 0 };
               });
               
               // Use the exercise ID/Name that was actually performed (e.g. if they swapped last time)
               // BUT, we want to start with the Default exercise for the template unless we want to be super smart.
               // Let's stick to the Template's default exercise, but prefill values if they match.
               // If they did an alternative last time, maybe we should swap to it? 
               // For simplicity: Load the TEMPLATE exercise, but assume the values are relevant.
               // Actually, if I did Dumbbell Press last time instead of Bench, and I prefill Bench with Dumbbell weights, that's dangerous.
               
               // Safety check: Only prefill if the ID matches the Template ID.
               // If they did an alternative, we should probably switch this slot to that alternative to match history?
               // Let's swap to what they did last time if it matches an alternative.
               
               let activeExId = ex.exerciseId;
               let activeExName = ex.name;
               
               if (prevLog.exerciseId !== ex.exerciseId) {
                  // It was an alternative (or rename). Check if it's a valid alternative.
                  const isAlt = ex.alternatives?.some(a => a.id === prevLog.exerciseId);
                  if (isAlt) {
                     activeExId = prevLog.exerciseId;
                     activeExName = prevLog.exerciseName;
                  }
               }

               return {
                  exerciseId: activeExId,
                  exerciseName: activeExName,
                  sets: newSets
               };
            }

            // No history for this exercise
            return {
               exerciseId: ex.exerciseId,
               exerciseName: ex.name,
               sets: Array.from({ length: ex.targetSets }, () => ({ weight: 0, reps: 0 }))
            };
         });
         setLogs(prefilledLogs);
      } else {
         // Brand new routine/day, clean slate
         setLogs(currentDay.exercises.map(ex => ({
           exerciseId: ex.exerciseId,
           exerciseName: ex.name,
           sets: Array.from({ length: ex.targetSets }, () => ({ weight: 0, reps: 0 }))
         })));
      }
    }
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: string) => {
    const newLogs = [...logs];
    const val = parseFloat(value) || 0;
    newLogs[exerciseIndex].sets[setIndex][field] = val;
    setLogs(newLogs);
  };

  const addSet = (exerciseIndex: number) => {
    const newLogs = [...logs];
    newLogs[exerciseIndex].sets.push({ weight: 0, reps: 0 });
    setLogs(newLogs);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const newLogs = [...logs];
    newLogs[exerciseIndex].sets.splice(setIndex, 1);
    setLogs(newLogs);
  };
  
  const swapExercise = (logIndex: number, newId: string, newName: string) => {
     if (!day) return;
     
     const currentLog = logs[logIndex];
     const memoryKey = `${logIndex}_${currentLog.exerciseId}`;
     
     // 1. Save current state to memory
     const updatedMemory = { ...exerciseMemory, [memoryKey]: currentLog };
     
     // 2. Check if we have memory for the destination
     const newKey = `${logIndex}_${newId}`;
     let newLogEntry = updatedMemory[newKey];
     
     if (!newLogEntry) {
         // 3. Default template
         const dayExerciseDef = day.exercises[logIndex];
         newLogEntry = {
            exerciseId: newId,
            exerciseName: newName,
            sets: Array.from({ length: dayExerciseDef.targetSets }, () => ({ weight: 0, reps: 0 }))
         };
     }

     setExerciseMemory(updatedMemory);
     
     const newLogs = [...logs];
     newLogs[logIndex] = newLogEntry;
     setLogs(newLogs);
  };

  const handleFinish = async () => {
    if (!day) return;
    
    // Construct ISO string with current time but selected date
    const selectedDateObj = new Date(workoutDate);
    const now = new Date();
    selectedDateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    const session: WorkoutSession = {
      id: sessionId || Date.now().toString(), // Use existing ID if editing
      date: selectedDateObj.toISOString(),
      routineName: routineName, // Save routine name
      dayName: day.name,
      logs: logs.filter(log => log.sets.length > 0),
      userId: '' // Backend handles this
    };
    await addSession(session);
    navigate('/');
  };

  if (!day) return <div>Day not found</div>;

  return (
    <div>
      <RestTimer />
      <div className="d-flex flex-column gap-3 mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="mb-0">{day.name}</h2>
          <Button variant="success" onClick={handleFinish} className="d-flex align-items-center gap-2">
            <CheckCircle size={20} /> Finish
          </Button>
        </div>
        
        <Card className="shadow-sm border-0 bg-light">
          <Card.Body className="py-2 d-flex align-items-center gap-2">
            <CalendarIcon size={18} className="text-muted" />
            <span className="text-muted fw-medium">Date:</span>
            <Form.Control 
              type="date" 
              value={workoutDate} 
              onChange={(e) => setWorkoutDate(e.target.value)} 
              className="border-0 bg-transparent p-0 shadow-none fw-bold text-primary w-auto"
            />
          </Card.Body>
        </Card>
      </div>

      {logs.map((log, exIndex) => {
         // Find the definition for this slot to get alternatives
         const dayExerciseDef = day.exercises[exIndex];
         const hasAlternatives = dayExerciseDef.alternatives && dayExerciseDef.alternatives.length > 0;
         
         return (
        <Card key={exIndex} className="mb-4 shadow-sm">
          <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
            <div>
               <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0">{log.exerciseName}</h5>
                  {hasAlternatives && (
                     <Dropdown>
                        <Dropdown.Toggle variant="link" size="sm" className="p-0 text-muted">
                           <RefreshCw size={16} />
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                           <Dropdown.Header>Swap Exercise</Dropdown.Header>
                           <Dropdown.Item 
                              active={log.exerciseId === dayExerciseDef.exerciseId}
                              onClick={() => swapExercise(exIndex, dayExerciseDef.exerciseId, dayExerciseDef.name)}
                           >
                              {dayExerciseDef.name} (Primary)
                           </Dropdown.Item>
                           {dayExerciseDef.alternatives?.map(alt => (
                              <Dropdown.Item 
                                 key={alt.id}
                                 active={log.exerciseId === alt.id}
                                 onClick={() => swapExercise(exIndex, alt.id, alt.name)}
                              >
                                 {alt.name}
                              </Dropdown.Item>
                           ))}
                        </Dropdown.Menu>
                     </Dropdown>
                  )}
               </div>
               <small className="text-muted">Target: {dayExerciseDef.targetSets} x {dayExerciseDef.targetReps}</small>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive className="mb-0 align-middle text-center">
              <thead className="bg-light">
                <tr>
                  <th style={{ width: '50px' }}>Set</th>
                  <th>kg</th>
                  <th>Reps</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {log.sets.map((set, setIndex) => (
                  <tr key={setIndex}>
                    <td>{setIndex + 1}</td>
                    <td>
                      <Form.Control
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={set.weight || ''}
                        onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)}
                        placeholder="0"
                        size="sm"
                        className="text-center"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        inputMode="numeric"
                        value={set.reps || ''}
                        onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                        placeholder="0"
                        size="sm"
                        className="text-center"
                      />
                    </td>
                    <td>
                      <Button 
                        variant="link" 
                        className="text-danger p-0" 
                        onClick={() => removeSet(exIndex, setIndex)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="p-2 border-top">
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="w-100 d-flex align-items-center justify-content-center gap-1"
                onClick={() => addSet(exIndex)}
              >
                <Plus size={16} /> Add Set
              </Button>
            </div>
          </Card.Body>
        </Card>
      )})} 
    </div>
  );
};

export default Workout;