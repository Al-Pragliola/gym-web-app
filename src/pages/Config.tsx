import { useState, useEffect } from 'react';
import { Button, Card, Form, Row, Col, ListGroup, Modal, Badge } from 'react-bootstrap';
import { fetchData } from '../utils/storage';
import type { Workout, WorkoutDay, WorkoutDayExercise, ExerciseDef } from '../types';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';

const Config = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<ExerciseDef[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded/Collapsed state
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  // Modal States
  const [showDayModal, setShowDayModal] = useState(false);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [newDayName, setNewDayName] = useState('');

  // Routine Modal
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');

  // Exercise Modal States
  const [showExModal, setShowExModal] = useState(false);
  const [editingEx, setEditingEx] = useState<{ workoutId: string, dayId: string, ex?: WorkoutDayExercise } | null>(null);
  const [exForm, setExForm] = useState({ exerciseId: '', sets: 3, reps: '8-12', alternatives: [] as string[] });

  const loadData = async () => {
    try {
      const data = await fetchData();
      setWorkouts(data.workouts);
      setExercises(data.exercises);
      if (data.workouts.length > 0 && !expandedWorkout) {
        setExpandedWorkout(data.workouts[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createRoutine = async () => {
    if (!newRoutineName.trim()) return;
    const newWorkout: Workout = {
      id: crypto.randomUUID(),
      userId: '', // set by backend
      name: newRoutineName,
      days: []
    };
    
    // Optimistic
    setWorkouts([...workouts, newWorkout]);
    setShowRoutineModal(false);
    setNewRoutineName('');
    
    try {
      await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkout)
      });
      loadData(); // Reload to ensure IDs/Sync
    } catch (e) {
      console.error(e);
    }
  };

  const saveWorkout = async (workout: Workout) => {
    try {
      // Optimistic Update
      const updatedWorkouts = workouts.map(w => w.id === workout.id ? workout : w);
      setWorkouts(updatedWorkouts);

      await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout)
      });
    } catch (e) {
      console.error(e);
      loadData(); // Revert on error
    }
  };

  const addDay = () => {
    if (!newDayName || !activeWorkoutId) return;
    const workout = workouts.find(w => w.id === activeWorkoutId);
    if (!workout) return;

    const newDay: WorkoutDay = {
      id: crypto.randomUUID(),
      workoutId: workout.id,
      name: newDayName,
      order: workout.days.length,
      exercises: []
    };

    const updatedWorkout = { ...workout, days: [...workout.days, newDay] };
    saveWorkout(updatedWorkout);
    setNewDayName('');
    setShowDayModal(false);
  };

  const deleteDay = (workoutId: string, dayId: string) => {
    if (!confirm('Delete this day?')) return;
    const workout = workouts.find(w => w.id === workoutId);
    if (!workout) return;

    const updatedWorkout = { ...workout, days: workout.days.filter(d => d.id !== dayId) };
    saveWorkout(updatedWorkout);
  };

  const openExModal = (workoutId: string, dayId: string, ex?: WorkoutDayExercise) => {
    setEditingEx({ workoutId, dayId, ex });
    if (ex) {
      setExForm({ 
         exerciseId: ex.exerciseId, 
         sets: ex.targetSets, 
         reps: ex.targetReps,
         alternatives: ex.alternatives ? ex.alternatives.map(a => a.id) : []
      });
    } else {
      setExForm({ exerciseId: '', sets: 3, reps: '8-12', alternatives: [] });
    }
    setShowExModal(true);
  };

  const saveExercise = () => {
    if (!editingEx) return;
    const workout = workouts.find(w => w.id === editingEx.workoutId);
    if (!workout) return;

    const day = workout.days.find(d => d.id === editingEx.dayId);
    if (!day) return;

    const selectedDef = exercises.find(e => e.id === exForm.exerciseId);
    if (!selectedDef) return;

    const resolvedAlts = exForm.alternatives
      .map(id => exercises.find(e => e.id === id))
      .filter((e): e is ExerciseDef => !!e);

    const newEx: WorkoutDayExercise = {
      id: editingEx.ex?.id || crypto.randomUUID(),
      dayId: day.id,
      exerciseId: exForm.exerciseId,
      name: selectedDef.name,
      targetSets: exForm.sets,
      targetReps: exForm.reps,
      order: editingEx.ex ? editingEx.ex.order : day.exercises.length,
      alternatives: resolvedAlts
    };

    const newDays = workout.days.map(d => {
      if (d.id === day.id) {
        let newExercises;
        if (editingEx.ex) {
          newExercises = d.exercises.map(e => e.id === editingEx.ex?.id ? newEx : e);
        } else {
          newExercises = [...d.exercises, newEx];
        }
        return { ...d, exercises: newExercises };
      }
      return d;
    });

    saveWorkout({ ...workout, days: newDays });
    setShowExModal(false);
  };
  
  const toggleAlternative = (id: string) => {
     if (exForm.alternatives.includes(id)) {
        setExForm({ ...exForm, alternatives: exForm.alternatives.filter(a => a !== id) });
     } else {
        setExForm({ ...exForm, alternatives: [...exForm.alternatives, id] });
     }
  };

  const deleteExercise = (workoutId: string, dayId: string, exId: string) => {
    const workout = workouts.find(w => w.id === workoutId);
    if (!workout) return;

    const newDays = workout.days.map(d => {
      if (d.id === dayId) {
        return { ...d, exercises: d.exercises.filter(e => e.id !== exId) };
      }
      return d;
    });
    saveWorkout({ ...workout, days: newDays });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>My Routines</h2>
        <Button variant="primary" onClick={() => setShowRoutineModal(true)} className="d-flex align-items-center gap-1">
          <Plus size={20} /> New Routine
        </Button>
      </div>

      {workouts.map(workout => (
        <Card key={workout.id} className="mb-4 shadow-sm border-0">
          <Card.Header className="bg-white py-3">
             <div className="d-flex justify-content-between align-items-center cursor-pointer" 
                  onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}>
                <h4 className="mb-0 d-flex align-items-center gap-2">
                   {expandedWorkout === workout.id ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                   {workout.name}
                </h4>
                <Button size="sm" variant="outline-primary" onClick={(e) => {
                  e.stopPropagation();
                  setActiveWorkoutId(workout.id);
                  setShowDayModal(true);
                }}>
                  <Plus size={16} /> Add Day
                </Button>
             </div>
          </Card.Header>
          
          {expandedWorkout === workout.id && (
            <Card.Body>
              {workout.days.length === 0 && <p className="text-muted text-center">No days configured. Add one!</p>}
              
              <Row className="g-3">
              {workout.days.map(day => (
                <Col xs={12} key={day.id}>
                  <Card className="border h-100">
                     <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                        <span className="fw-bold">{day.name}</span>
                        <div className="d-flex gap-2">
                           <Button size="sm" variant="link" onClick={() => openExModal(workout.id, day.id)}>
                              <Plus size={16} /> Add Exercise
                           </Button>
                           <Button size="sm" variant="link" className="text-danger" onClick={() => deleteDay(workout.id, day.id)}>
                              <Trash2 size={16} />
                           </Button>
                        </div>
                     </Card.Header>
                     <ListGroup variant="flush">
                        {day.exercises.map(ex => (
                           <ListGroup.Item key={ex.id} className="d-flex justify-content-between align-items-center">
                              <div>
                                 <div>{ex.name}</div>
                                 <small className="text-muted">{ex.targetSets} x {ex.targetReps}</small>
                              </div>
                              <div className="d-flex gap-1">
                                 <Button size="sm" variant="link" onClick={() => openExModal(workout.id, day.id, ex)}>
                                    <Edit2 size={14} />
                                 </Button>
                                 <Button size="sm" variant="link" className="text-danger" onClick={() => deleteExercise(workout.id, day.id, ex.id)}>
                                    <Trash2 size={14} />
                                 </Button>
                              </div>
                           </ListGroup.Item>
                        ))}
                     </ListGroup>
                  </Card>
                </Col>
              ))}
              </Row>
            </Card.Body>
          )}
        </Card>
      ))}

      {/* Routine Modal */}
      <Modal show={showRoutineModal} onHide={() => setShowRoutineModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create New Routine</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Routine Name (e.g. Winter Bulk)</Form.Label>
            <Form.Control 
              autoFocus
              type="text" 
              value={newRoutineName}
              onChange={e => setNewRoutineName(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRoutineModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={createRoutine}>Create</Button>
        </Modal.Footer>
      </Modal>

      {/* Day Modal */}
      <Modal show={showDayModal} onHide={() => setShowDayModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add New Day</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Day Name (e.g. Pull Day)</Form.Label>
            <Form.Control 
              autoFocus
              type="text" 
              value={newDayName}
              onChange={e => setNewDayName(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDayModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={addDay}>Create Day</Button>
        </Modal.Footer>
      </Modal>

      {/* Exercise Modal */}
      <Modal show={showExModal} onHide={() => setShowExModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingEx?.ex ? 'Edit Exercise' : 'Add Exercise to Day'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-flex flex-column gap-3">
            <Form.Group>
              <Form.Label>Select Exercise</Form.Label>
              <Form.Select 
                 value={exForm.exerciseId}
                 onChange={e => setExForm({...exForm, exerciseId: e.target.value})}
                 disabled={!!editingEx?.ex}
              >
                 <option value="">-- Choose Exercise --</option>
                 {exercises.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                 ))}
              </Form.Select>
              <Form.Text className="text-muted">
                 Don't see it? <a href="/exercises">Create it in the Library</a> first.
              </Form.Text>
            </Form.Group>

            <Row>
              <Col>
                <Form.Group>
                  <Form.Label>Target Sets</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={exForm.sets} 
                    onChange={(e) => setExForm({...exForm, sets: parseInt(e.target.value) || 0})}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group>
                  <Form.Label>Target Reps</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={exForm.reps} 
                    onChange={(e) => setExForm({...exForm, reps: e.target.value})}
                    placeholder="e.g. 8-12"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group>
              <Form.Label>Alternatives</Form.Label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                 {exForm.alternatives.map(altId => {
                    const altDef = exercises.find(e => e.id === altId);
                    return (
                       <Badge key={altId} bg="info" className="d-flex align-items-center gap-1">
                          {altDef?.name}
                          <span style={{cursor:'pointer'}} onClick={() => toggleAlternative(altId)}>&times;</span>
                       </Badge>
                    );
                 })}
              </div>
              <Form.Select 
                 value="" 
                 onChange={e => {
                    if (e.target.value) toggleAlternative(e.target.value);
                 }}
              >
                 <option value="">+ Add Alternative</option>
                 {exercises
                    .filter(e => e.id !== exForm.exerciseId && !exForm.alternatives.includes(e.id))
                    .map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                 ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={saveExercise} disabled={!exForm.exerciseId}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Config;