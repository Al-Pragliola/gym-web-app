import { useState, useEffect } from 'react';
import { Button, Card, Form, ListGroup, Modal } from 'react-bootstrap';
import { fetchData } from '../utils/storage';
import type { ExerciseDef } from '../types';
import { Plus, Search } from 'lucide-react';

const Exercises = () => {
  const [exercises, setExercises] = useState<ExerciseDef[]>([]);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newExName, setNewExName] = useState('');

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    try {
      const data = await fetchData();
      setExercises(data.exercises);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = async () => {
    if (!newExName.trim()) return;
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newExName })
      });
      if (res.ok) {
        await loadExercises();
        setNewExName('');
        setShowModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = exercises.filter(e => 
    e.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Exercise Library</h2>
        <Button onClick={() => setShowModal(true)} className="d-flex align-items-center gap-1">
          <Plus size={20} /> New Exercise
        </Button>
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Body className="p-2">
          <div className="d-flex align-items-center gap-2">
            <Search size={20} className="text-muted ms-2" />
            <Form.Control 
              type="text" 
              placeholder="Search exercises..." 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border-0 shadow-none"
            />
          </div>
        </Card.Body>
      </Card>

      <ListGroup>
        {filtered.map(ex => (
          <ListGroup.Item key={ex.id}>
            {ex.name}
          </ListGroup.Item>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted py-5">
            No exercises found. Create one!
          </div>
        )}
      </ListGroup>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create New Exercise</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Exercise Name</Form.Label>
            <Form.Control 
              autoFocus
              type="text" 
              placeholder="e.g. Incline Bench Press" 
              value={newExName}
              onChange={e => setNewExName(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd}>Create</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Exercises;
