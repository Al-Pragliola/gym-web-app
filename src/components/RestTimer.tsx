import { useState, useEffect } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react';

const RestTimer = () => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [defaultTime, setDefaultTime] = useState(120); // 2 minutes default

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      if (isActive) {
         // Play sound or notify?
         try {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play();
         } catch(e) {}
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(defaultTime);
  };
  
  const startTimer = (seconds: number) => {
     setDefaultTime(seconds);
     setTimeLeft(seconds);
     setIsActive(true);
     setShowModal(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <>
      {/* Floating Timer Bubble (Only visible when active or paused with time left) */}
      {(isActive || timeLeft > 0) && (
        <div 
          className="position-fixed bottom-0 end-0 m-3 p-2 bg-dark text-white rounded shadow-lg d-flex align-items-center gap-3" 
          style={{ zIndex: 1050 }}
        >
          <div className="fw-bold fs-4 font-monospace" style={{minWidth: '60px', textAlign: 'center'}}>
             {formatTime(timeLeft)}
          </div>
          <div className="d-flex gap-1">
             <Button variant="outline-light" size="sm" onClick={toggleTimer}>
                {isActive ? <Pause size={16}/> : <Play size={16}/>}
             </Button>
             <Button variant="outline-light" size="sm" onClick={resetTimer}>
                <RotateCcw size={16}/>
             </Button>
             <Button variant="outline-light" size="sm" onClick={() => { setIsActive(false); setTimeLeft(0); }}>
                <X size={16}/>
             </Button>
          </div>
        </div>
      )}

      {/* Trigger Button (To set timer) */}
      <Button 
         variant="secondary" 
         className="position-fixed bottom-0 start-0 m-3 rounded-circle shadow" 
         style={{ width: '50px', height: '50px', zIndex: 1040 }}
         onClick={() => setShowModal(true)}
      >
        <Timer size={24} />
      </Button>

      {/* Configuration Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title>Set Rest Timer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
           <div className="d-grid gap-2">
              <Button variant="outline-primary" onClick={() => startTimer(60)}>1:00</Button>
              <Button variant="outline-primary" onClick={() => startTimer(90)}>1:30</Button>
              <Button variant="outline-primary" onClick={() => startTimer(120)}>2:00</Button>
              <Button variant="outline-primary" onClick={() => startTimer(180)}>3:00</Button>
              <Button variant="outline-primary" onClick={() => startTimer(300)}>5:00</Button>
           </div>
           <hr />
           <Form.Group>
              <Form.Label>Custom (seconds)</Form.Label>
              <div className="d-flex gap-2">
                 <Form.Control type="number" defaultValue={defaultTime} id="customTime" />
                 <Button onClick={() => {
                    const val = parseInt((document.getElementById('customTime') as HTMLInputElement).value);
                    if (val > 0) startTimer(val);
                 }}>Go</Button>
              </div>
           </Form.Group>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default RestTimer;
