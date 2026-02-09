import { useEffect, useState } from 'react';
import { Accordion, Badge, ListGroup, Card } from 'react-bootstrap';
import Calendar from 'react-calendar';
import { fetchData } from '../utils/storage';
import type { WorkoutSession } from '../types';
import './Calendar.css';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

const History = () => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSessions, setSelectedSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    fetchData().then(data => {
      setSessions(data.history);
      updateSelectedSessions(new Date(), data.history);
    });
  }, []);

  const updateSelectedSessions = (date: Date, allSessions: WorkoutSession[]) => {
    // Filter sessions that match the selected date (ignoring time)
    const filtered = allSessions.filter(s => {
      const sDate = new Date(s.date);
      return sDate.getDate() === date.getDate() &&
             sDate.getMonth() === date.getMonth() &&
             sDate.getFullYear() === date.getFullYear();
    });
    setSelectedSessions(filtered);
  };

  const onDateChange = (value: Value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      updateSelectedSessions(value, sessions);
    }
  };

  const getTileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const hasWorkout = sessions.some(s => {
        const sDate = new Date(s.date);
        return sDate.getDate() === date.getDate() &&
               sDate.getMonth() === date.getMonth() &&
               sDate.getFullYear() === date.getFullYear();
      });
      return hasWorkout ? <div className="workout-indicator" /> : null;
    }
    return null;
  };

  return (
    <div>
      <h2 className="mb-4 text-center">Workout Calendar</h2>
      
      <div className="d-flex justify-content-center mb-4">
        <Calendar 
          onChange={onDateChange} 
          value={selectedDate}
          tileContent={getTileContent}
        />
      </div>

      <h4 className="mb-3">
        {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </h4>

      {selectedSessions.length === 0 ? (
        <Card className="text-center py-4 bg-light border-0">
          <Card.Body className="text-muted">
            No workouts recorded for this day.
          </Card.Body>
        </Card>
      ) : (
        <Accordion defaultActiveKey="0">
          {selectedSessions.map((session, idx) => (
            <Accordion.Item eventKey={idx.toString()} key={session.id} className="mb-3 border rounded shadow-sm overflow-hidden">
              <Accordion.Header>
                <div className="d-flex flex-column w-100 pe-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 text-primary">{session.dayName}</h5>
                    <Badge bg="secondary">{session.logs.length} Exercises</Badge>
                  </div>
                  <small className="text-muted mt-1">
                    {new Date(session.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </small>
                </div>
              </Accordion.Header>
              <Accordion.Body className="p-0">
                <ListGroup variant="flush">
                  {session.logs.map((log, lIdx) => (
                    <ListGroup.Item key={lIdx} className="py-3">
                      <div className="fw-bold mb-2">{log.exerciseName}</div>
                      <div className="d-flex flex-wrap gap-2">
                        {log.sets.map((set, sIdx) => (
                          <Badge 
                            key={sIdx} 
                            bg="light" 
                            text="dark" 
                            className="border p-2"
                          >
                            Set {sIdx + 1}: {set.weight}kg x {set.reps}
                          </Badge>
                        ))}
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default History;
