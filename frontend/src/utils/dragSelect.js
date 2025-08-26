export default function initDragSelect(containerEl, canvasEl, onSelect) {
  const ctx = canvasEl.getContext('2d');

  function resize() {
    canvasEl.width  = containerEl.clientWidth;
    canvasEl.height = containerEl.clientHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  let drawing = false, startX = 0, startY = 0;

  canvasEl.addEventListener('mousedown', e => {
    const r = canvasEl.getBoundingClientRect();
    startX = e.clientX - r.left;
    startY = e.clientY - r.top;
    drawing = true;
  });

  canvasEl.addEventListener('mousemove', e => {
    if (!drawing) return;
    const r = canvasEl.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const w = x - startX, h = y - startY;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.strokeStyle = 'lime';
    ctx.lineWidth   = 2;
    ctx.strokeRect(startX, startY, w, h);
  });

  function endDrag(e) {
    if (!drawing) return;
    drawing = false;
    const r = canvasEl.getBoundingClientRect();
    const endX = e.clientX - r.left;
    const endY = e.clientY - r.top;
    const rect = {
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY
    };
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    onSelect && onSelect(rect);
  }

  canvasEl.addEventListener('mouseup',   endDrag);
  canvasEl.addEventListener('mouseleave', endDrag);
}
