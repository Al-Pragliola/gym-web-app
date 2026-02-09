import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Container, Nav, Navbar, Spinner, Dropdown } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Config from './pages/Config';
import Workout from './pages/Workout';
import History from './pages/History';
import Login from './pages/Login';
import Exercises from './pages/Exercises';
import Progress from './pages/Progress';
import { Settings, Home, History as HistoryIcon, LogOut, Dumbbell, TrendingUp } from 'lucide-react';
import { checkAuth } from './utils/storage';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  return (
    <Router>
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
          <Container>
            <Navbar.Brand as={Link} to="/">Gym Tracker</Navbar.Brand>
            <Nav className="ms-auto flex-row align-items-center gap-3">
              <Nav.Link as={Link} to="/"><Home size={24} /></Nav.Link>
              <Nav.Link as={Link} to="/history"><HistoryIcon size={24} /></Nav.Link>
              <Nav.Link as={Link} to="/progress"><TrendingUp size={24} /></Nav.Link>
              <Nav.Link as={Link} to="/exercises"><Dumbbell size={24} /></Nav.Link>
              <Nav.Link as={Link} to="/config"><Settings size={24} /></Nav.Link>
              
              <div className="vr text-secondary mx-2"></div>
              
              <Dropdown align="end">
                <Dropdown.Toggle variant="dark" id="dropdown-user" className="p-0 border-0 d-flex align-items-center">
                  <div className="bg-secondary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                    <span className="text-white fw-bold" style={{ fontSize: '14px' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Header>{user.name}</Dropdown.Header>
                  <Dropdown.Item onClick={handleLogout} className="text-danger">
                    <LogOut size={16} className="me-2" />
                    Sign Out
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Container>
        </Navbar>

        <Container className="py-4 flex-grow-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/config" element={<Config />} />
            <Route path="/workout/:dayId" element={<Workout />} />
            <Route path="/history" element={<History />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/progress" element={<Progress />} />
          </Routes>
        </Container>
      </div>
    </Router>
  );
}

export default App;