import { useEffect, useState } from 'react';
import { Button, Card, Col, Row, Badge, Accordion } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { fetchData } from '../utils/storage';
import type { Workout } from '../types';
import { Play, ChevronRight } from 'lucide-react';

const Dashboard = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    fetchData().then(data => setWorkouts(data.workouts));
  }, []);

  return (
    <div>
      <h2 className="mb-4 text-center">Start Workout</h2>
      
      {workouts.length === 0 ? (
        <div className="text-center py-5">
          <p className="text-muted">No routines found.</p>
          <Button as={Link as any} to="/config" variant="primary">
            Create a Routine
          </Button>
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {workouts.map(workout => (
            <div key={workout.id}>
               <h5 className="mb-3 text-secondary border-bottom pb-2">{workout.name}</h5>
               <Row className="g-3">
                  {workout.days.map((day) => (
                    <Col xs={12} md={6} lg={4} key={day.id}>
                      <Card className="shadow-sm h-100 border-0 bg-white hover-card">
                        <Card.Body className="d-flex justify-content-between align-items-center">
                          <div>
                            <h4 className="mb-1">{day.name}</h4>
                            <p className="text-muted mb-0 small">{day.exercises.length} exercises</p>
                          </div>
                          <Button 
                            as={Link as any} 
                            to={`/workout/${day.id}`} 
                            variant="primary" 
                            size="lg"
                            className="rounded-circle d-flex align-items-center justify-content-center shadow"
                            style={{ width: '56px', height: '56px' }}
                          >
                            <Play fill="white" size={24} className="ms-1" />
                          </Button>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
               </Row>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
