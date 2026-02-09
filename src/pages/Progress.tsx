import { useState, useEffect } from 'react';
import { Card, Form, Container, Spinner } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchData } from '../utils/storage';
import type { AppData, WorkoutSession } from '../types';
import { TrendingUp } from 'lucide-react';

const Progress = () => {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [routineNames, setRoutineNames] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [selectedRoutine, setSelectedRoutine] = useState<string>('All Routines');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchData();
      setHistory(data.history);
      
      // Extract unique exercise names and routine names from history
      const exNames = new Set<string>();
      const routNames = new Set<string>();
      
      // Add all configured routines to the list
      data.workouts.forEach(w => routNames.add(w.name));

      data.history.forEach(session => {
        if (session.routineName && session.routineName.trim() !== '') {
           routNames.add(session.routineName);
        }
        session.logs.forEach(log => {
          exNames.add(log.exerciseName);
        });
      });
      
      setExerciseNames(Array.from(exNames).sort());
      setRoutineNames(Array.from(routNames).sort());
      
      if (exNames.size > 0) {
        setSelectedExercise(Array.from(exNames).sort()[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedExercise || history.length === 0) return;

    // Filter history by routine if selected
    const filteredHistory = selectedRoutine === 'All Routines' 
      ? history 
      : history.filter(s => s.routineName === selectedRoutine);

    // Process data for the selected exercise
    const dataPoints: { date: string, rawDate: number, weight: number }[] = [];

    filteredHistory.forEach(session => {
      const log = session.logs.find(l => l.exerciseName === selectedExercise);
      if (log) {
        // Find max weight in this session
        let maxWeight = 0;
        log.sets.forEach(set => {
          if (set.weight > maxWeight) maxWeight = set.weight;
        });

        if (maxWeight > 0) {
          dataPoints.push({
             date: new Date(session.date).toLocaleDateString(),
             rawDate: new Date(session.date).getTime(),
             weight: maxWeight
          });
        }
      }
    });

    // Sort by date ascending
    dataPoints.sort((a, b) => a.rawDate - b.rawDate);
    setChartData(dataPoints);

  }, [selectedExercise, selectedRoutine, history]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-4">
        <TrendingUp size={28} className="text-primary" />
        <h2 className="mb-0">Progress Tracker</h2>
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-md-row gap-3">
             <Form.Group className="flex-grow-1">
               <Form.Label className="fw-bold">Select Exercise</Form.Label>
               <Form.Select 
                 value={selectedExercise} 
                 onChange={(e) => setSelectedExercise(e.target.value)}
               >
                 {exerciseNames.map(name => (
                   <option key={name} value={name}>{name}</option>
                 ))}
               </Form.Select>
             </Form.Group>
             
             <Form.Group className="flex-grow-1">
               <Form.Label className="fw-bold">Filter by Routine</Form.Label>
               <Form.Select 
                 value={selectedRoutine} 
                 onChange={(e) => setSelectedRoutine(e.target.value)}
               >
                 <option value="All Routines">All Routines</option>
                 {routineNames.map(name => (
                   <option key={name} value={name}>{name}</option>
                 ))}
               </Form.Select>
             </Form.Group>
          </div>
        </Card.Body>
      </Card>

      {chartData.length > 0 ? (
        <Card className="shadow-sm">
          <Card.Body style={{ height: '400px' }}>
             <h5 className="text-center mb-4">{selectedExercise} - Max Weight (kg)</h5>
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    padding={{ left: 30, right: 30 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    domain={['dataMin - 5', 'dataMax + 5']} 
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#0d6efd" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0d6efd', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                    animationDuration={1000}
                  />
                </LineChart>
             </ResponsiveContainer>
          </Card.Body>
        </Card>
      ) : (
        <div className="text-center text-muted py-5">
          <p>No data found for this exercise.</p>
        </div>
      )}
    </div>
  );
};

export default Progress;
