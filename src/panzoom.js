// Pan & zoom for the map SVG by manipulating its viewBox.
// Uses Pointer Events so mouse drag, touch drag and pinch all work the
// same way, plus wheel zoom, double click/tap zoom and on-screen buttons.
function initPanZoom(svgElement, container) {
  const [fullX, fullY, fullW, fullH] = svgElement
    .getAttribute("viewBox")
    .split(/\s+/)
    .map(Number);
  const MAX_ZOOM = 8;
  const WHEEL_STEP = 1.2;

  const vb = { x: fullX, y: fullY, w: fullW, h: fullH };
  const pointers = new Map(); // active pointerId -> {x, y}
  let pinchDistance = 0;

  function applyViewBox() {
    svgElement.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  // Keep the view inside the original map bounds
  function clampPan() {
    vb.x = Math.min(Math.max(vb.x, fullX), fullX + fullW - vb.w);
    vb.y = Math.min(Math.max(vb.y, fullY), fullY + fullH - vb.h);
  }

  function toSvgPoint(clientX, clientY) {
    const rect = svgElement.getBoundingClientRect();
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
    };
  }

  // Zoom by `factor` (>1 zooms out, <1 zooms in) keeping `point` fixed
  function zoomAt(point, factor) {
    const targetW = Math.min(Math.max(vb.w * factor, fullW / MAX_ZOOM), fullW);
    const f = targetW / vb.w;
    vb.x = point.x - (point.x - vb.x) * f;
    vb.y = point.y - (point.y - vb.y) * f;
    vb.w *= f;
    vb.h *= f;
    clampPan();
    applyViewBox();
  }

  function zoomAtCenter(factor) {
    zoomAt({ x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }, factor);
  }

  function reset() {
    vb.x = fullX;
    vb.y = fullY;
    vb.w = fullW;
    vb.h = fullH;
    applyViewBox();
  }

  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(toSvgPoint(e.clientX, e.clientY), e.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP);
  }, { passive: false });

  container.addEventListener("dblclick", (e) => {
    zoomAt(toSvgPoint(e.clientX, e.clientY), 0.5);
  });

  container.addEventListener("pointerdown", (e) => {
    // Leave the zoom buttons alone: capturing their pointer retargets the
    // resulting click to the container and the buttons never fire
    if (e.target.closest(".zoom-controls")) {
      return;
    }
    container.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchDistance = 0;
  });

  container.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.values()];
    const rect = svgElement.getBoundingClientRect();

    if (points.length === 1) {
      // Drag to pan
      vb.x -= ((e.clientX - prev.x) / rect.width) * vb.w;
      vb.y -= ((e.clientY - prev.y) / rect.height) * vb.h;
      clampPan();
      applyViewBox();
    } else if (points.length === 2) {
      // Pinch to zoom around the midpoint
      const [a, b] = points;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0) {
        const mid = toSvgPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(mid, pinchDistance / distance);
      }
      pinchDistance = distance;
    }
  });

  function releasePointer(e) {
    if (container.hasPointerCapture(e.pointerId)) {
      container.releasePointerCapture(e.pointerId);
    }
    pointers.delete(e.pointerId);
    pinchDistance = 0;
  }
  container.addEventListener("pointerup", releasePointer);
  container.addEventListener("pointercancel", releasePointer);

  // On-screen controls (also the only zoom UI on desktop without a wheel)
  const controls = document.createElement("div");
  controls.className = "zoom-controls";
  [
    ["+", "Zoom in", () => zoomAtCenter(1 / WHEEL_STEP ** 2)],
    ["−", "Zoom out", () => zoomAtCenter(WHEEL_STEP ** 2)],
    ["⛶", "Reset zoom", reset],
  ].forEach(([label, title, onClick]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", onClick);
    controls.appendChild(button);
  });
  container.appendChild(controls);
}
