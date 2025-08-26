import { useEffect, useRef } from "react";

export default function FocusMaskCanvas({
  getVideoEl,        
  rect,               
  active,             
  blurRadius = 8      
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function loop() {
      const video = getVideoEl?.();
      if (!active || !video || video.readyState < 2 || !video.videoWidth) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = requestAnimationFrame(loop);
        return;
        }

        const cw = video.clientWidth || video.videoWidth;
      const ch = video.clientHeight || video.videoHeight;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      ctx.clearRect(0, 0, cw, ch);
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.drawImage(video, 0, 0, cw, ch);
      ctx.filter = "none";

      if (rect && rect.width > 0 && rect.height > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        ctx.drawImage(video, 0, 0, cw, ch); 
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, blurRadius, rect, getVideoEl]);

  return (
    <canvas
      ref={canvasRef}
      className="focus-mask-canvas"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2
      }}
    />
  );
}
