import { useRef, useEffect } from 'react';
import initDragSelect from '../utils/dragSelect';
import '../styles/dragSelect.css';

export default function DragSelect({
  children,
  active = false,
  onSelect
}) {
  const containerRef = useRef();
  const canvasRef    = useRef();

  useEffect(() => {
    if (!active) return;
    const teardown = initDragSelect(
      containerRef.current,
      canvasRef.current,
      onSelect
    );
    return teardown; 
  }, [active, onSelect]);

  return (
    <div
      ref={containerRef}
      className="select-container"
      style={{ position: 'relative' }}
    >
      {children}

      {active && (
        <canvas
          ref={canvasRef}
          className="select-overlay"
        />
      )}
    </div>
  );
}
