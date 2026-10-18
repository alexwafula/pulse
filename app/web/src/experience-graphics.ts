import { createElement, ListVideo } from "lucide";

type Graphic = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; svg: SVGSVGElement; host: HTMLElement };
const number = (element: Element, attribute: string): number => Number(element.getAttribute(attribute));
const mapSelections = new Map<string, string>();

function field(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#2e7a53"; ctx.fillRect(-2, -2, 109, 72);
  for (let stripe = 0; stripe < 14; stripe++) {
    ctx.fillStyle = stripe % 2 ? "#29714c" : "#2e7a53";
    ctx.fillRect(stripe * 7.5, 0, 7.5, 68);
  }
  ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = .35;
  ctx.strokeRect(0,0,105,68);
  ctx.beginPath(); ctx.moveTo(52.5,0); ctx.lineTo(52.5,68); ctx.stroke();
  ctx.beginPath(); ctx.arc(52.5,34,9.15,0,Math.PI*2); ctx.stroke();
  ctx.strokeRect(0,13.84,16.5,40.32); ctx.strokeRect(88.5,13.84,16.5,40.32);
  ctx.strokeRect(0,24.84,5.5,18.32); ctx.strokeRect(99.5,24.84,5.5,18.32);
}

function drawMap({context: ctx, svg, host}: Graphic): void {
  field(ctx);
  if (host.dataset.mapMode === "occupancy") {
    for (const cell of svg.querySelectorAll<SVGRectElement>(".heat-cells rect")) {
      const x = number(cell,"x") + 2.5, y = number(cell,"y") + 2;
      const alpha = number(cell,"fill-opacity") * .85;
      const gradient = ctx.createRadialGradient(x,y,0,x,y,8);
      gradient.addColorStop(0,`rgba(255,214,10,${alpha})`);
      gradient.addColorStop(.35,`rgba(255,214,10,${alpha*.5})`);
      gradient.addColorStop(1,"rgba(255,214,10,0)");
      ctx.fillStyle = gradient; ctx.fillRect(x-8,y-8,16,16);
    }
  } else if (host.dataset.mapMode === "network") {
    for (const link of svg.querySelectorAll<SVGPathElement>(".network-lines path")) {
      ctx.strokeStyle = "rgba(255,255,255,.65)";
      ctx.lineWidth = Math.min(1.8,.35 + number(link,"data-pass-count")*.2);
      ctx.stroke(new Path2D(link.getAttribute("d")!));
      const length = link.getTotalLength();
      if (length > 7) {
        const from = link.getPointAtLength(0), to = link.getPointAtLength(length);
        const angle = Math.atan2(to.y-from.y,to.x-from.x);
        ctx.save(); ctx.translate(to.x-Math.cos(angle)*3.5,to.y-Math.sin(angle)*3.5); ctx.rotate(angle);
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-1.5,-.8); ctx.lineTo(-1.5,.8); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    for (const node of svg.querySelectorAll<SVGGElement>(".network-node")) {
      const x = number(node,"data-x"), y = number(node,"data-y"), radius = number(node,"data-radius");
      ctx.fillStyle = host.dataset.teamIndex === "1" ? "#3a7fd5" : "#d9485f";
      ctx.strokeStyle = "#fff"; ctx.lineWidth = .35;
      ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `700 ${radius*.95}px Outfit, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(node.dataset.number!,x,y+.1);
    }
  } else {
    for (const point of svg.querySelectorAll<SVGCircleElement>(".shot-points circle")) {
      const x = number(point,"cx"), y = number(point,"cy");
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = "#ffd60a"; ctx.beginPath(); ctx.arc(x,y,1.35,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawChart({context: ctx, svg, host}: Graphic): void {
  ctx.clearRect(0,0,280,100);
  ctx.strokeStyle = "#e0e4e8"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(14,88); ctx.lineTo(266,88); ctx.moveTo(14,16); ctx.lineTo(266,16); ctx.stroke();
  ctx.font = "9px 'Plus Jakarta Sans', sans-serif"; ctx.fillStyle = "#66748a";
  ctx.fillText(svg.querySelector("text")!.textContent!,0,20); ctx.fillText("0",0,91);
  for (const [team,color] of [["home","#d9485f"],["away","#3a7fd5"]]) {
    ctx.fillStyle = color; ctx.globalAlpha = .12;
    ctx.fill(new Path2D(svg.querySelector(`.chart-${team}-area`)!.getAttribute("d")!));
    ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.stroke(new Path2D(svg.querySelector(`.chart-${team}`)!.getAttribute("d")!));
    ctx.beginPath(); ctx.arc(Number(host.dataset.endX),Number(team === "home" ? host.dataset.homeY : host.dataset.awayY),2.7,0,Math.PI*2); ctx.fill();
  }
}

function mapInteraction(host: HTMLElement, svg: SVGSVGElement, canvas?: HTMLCanvasElement): () => void {
  const inspector = host.closest(".experience-map")!.querySelector<HTMLElement>(".map-inspector")!;
  const selection = inspector.querySelector<HTMLSelectElement>("select")!;
  const detail = inspector.querySelector<HTMLOutputElement>("output")!;
  const evidence = inspector.querySelector<HTMLElement>(".map-inspector-evidence")!;
  const scenario = document.querySelector<HTMLSelectElement>("#scenario")!.value;
  const memoryKey = `${scenario}/${svg.dataset.mapTeam}/${host.dataset.mapMode}`;
  selection.value = mapSelections.get(memoryKey) ?? "";
  function inspect(): void {
    mapSelections.set(memoryKey, selection.value);
    selection.dispatchEvent(new CustomEvent("pulse:selection", {bubbles:true}));
    const option = selection.selectedOptions[0];
    detail.textContent = option?.dataset.detail ?? "";
    evidence.replaceChildren();
    for (const eventId of (option?.dataset.evidence ?? "").split(" ").filter(Boolean)) {
      const button = document.createElement("button"); button.type = "button";
      button.className = "evidence-button"; button.dataset.inspectEvent = eventId;
      button.title = `Inspect ${eventId}`;
      const label = document.createElement("span"); label.textContent = eventId;
      button.append(createElement(ListVideo), label); evidence.append(button);
    }
  }
  inspect();
  selection.addEventListener("change", inspect);
  if (!canvas) return () => selection.removeEventListener("change", inspect);
  const surface = canvas;
  const tooltip = document.createElement("span"); tooltip.className = "graphic-tooltip"; tooltip.hidden = true;
  tooltip.setAttribute("role","tooltip"); host.append(tooltip);
  function hit(event: MouseEvent): SVGElement | undefined {
    const bounds = surface.getBoundingClientRect();
    if (!surface.isConnected || bounds.width <= 0 || bounds.height <= 0) return;
    const x = (event.clientX-bounds.left)/bounds.width*109-2;
    const y = (event.clientY-bounds.top)/bounds.height*72-2;
    if (host.dataset.mapMode === "occupancy") {
      return Array.from(svg.querySelectorAll<SVGRectElement>(".heat-cells rect")).find(cell => x >= number(cell,"x") && x < number(cell,"x")+5 && y >= number(cell,"y") && y < number(cell,"y")+4);
    } else if (host.dataset.mapMode === "network") {
      return Array.from(svg.querySelectorAll<SVGGElement>(".network-node")).find(node => Math.hypot(x-number(node,"data-x"),y-number(node,"data-y")) <= Math.max(3,number(node,"data-radius")));
    } else {
      const tolerance = event instanceof PointerEvent && event.pointerType === "touch" ? 22 : 10;
      let nearest: SVGCircleElement | undefined;
      let distance = Math.max(tolerance, 3 * bounds.width / 109);
      for (const point of svg.querySelectorAll<SVGCircleElement>(".shot-points circle")) {
        const pixels = Math.hypot((x-number(point,"cx"))*bounds.width/109, (y-number(point,"cy"))*bounds.height/72);
        if (pixels < distance) { nearest = point; distance = pixels; }
      }
      return nearest;
    }
  }
  const move = (event: PointerEvent): void => {
    const element = hit(event), text = element?.querySelector("title")?.textContent;
    tooltip.hidden = !text; tooltip.textContent = text ?? "";
    canvas.style.cursor = element ? "pointer" : "default";
  };
  const leave = (): void => { tooltip.hidden = true; };
  const click = (event: MouseEvent): void => {
    const element = hit(event);
    if (!element) return;
    selection.value = element.dataset.mapKey!;
    inspect();
    if (element.dataset.shotEvent) document.dispatchEvent(new CustomEvent("pulse:map-inspect", {detail: {eventId: element.dataset.shotEvent}}));
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("click", click);
  return () => {
    selection.removeEventListener("change", inspect); tooltip.remove();
    canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerleave", leave); canvas.removeEventListener("click", click);
  };
}

// Repaint only presentation paths/cells supplied by Go. No football calculations.
export function paintExperienceGraphics(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  for (const host of root.querySelectorAll<HTMLElement>(".chart-art, .map-art")) {
    const svg = host.querySelector<SVGSVGElement>("svg")!;
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (!context || typeof Path2D === "undefined") {
      if (host.classList.contains("map-art")) cleanups.push(mapInteraction(host, svg));
      continue;
    }
    canvas.className = "experience-graphic";
    canvas.setAttribute("role","img"); canvas.setAttribute("aria-label",svg.getAttribute("aria-label")!);
    canvas.dataset.graphic = host.classList.contains("map-art") ? "map" : "chart";
    const graphic = {canvas, context, svg, host};
    let disposed = false;
    let contextLost = false;
    let frame = 0;
    const smoothingNote = host.closest(".experience-map")?.querySelector<HTMLElement>(".smoothed-note");
    function fallback(): void {
      canvas.hidden = true;
      delete canvas.dataset.ready;
      svg.style.visibility = "";
      if (smoothingNote) smoothingNote.hidden = true;
    }
    function draw(): void {
      frame = 0;
      if (disposed || contextLost || !host.isConnected) return;
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(devicePixelRatio || 1,2);
      const pixelWidth = Math.max(1, Math.round(width*dpr)), pixelHeight = Math.max(1, Math.round(height*dpr));
      // Assigning a canvas dimension clears it, even when its value is unchanged.
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      context!.setTransform(1,0,0,1,0,0);
      context!.clearRect(0,0,canvas.width,canvas.height);
      if (canvas.dataset.graphic === "map") {
        context!.setTransform(canvas.width/109,0,0,canvas.height/72,canvas.width/109*2,canvas.height/72*2);
        drawMap(graphic);
      } else {
        context!.setTransform(canvas.width/280,0,0,canvas.height/100,0,0);
        drawChart(graphic);
      }
      canvas.hidden = false;
      canvas.dataset.ready = "true";
      svg.style.visibility = "hidden";
      if (smoothingNote) smoothingNote.hidden = false;
    }
    function scheduleDraw(): void {
      if (!disposed && !frame) frame = requestAnimationFrame(draw);
    }
    const lost = (event: Event): void => {
      event.preventDefault(); contextLost = true;
      cancelAnimationFrame(frame); frame = 0; fallback();
    };
    const restored = (): void => { contextLost = false; scheduleDraw(); };
    canvas.hidden = true;
    host.append(canvas);
    canvas.addEventListener("contextlost", lost);
    canvas.addEventListener("contextrestored", restored);
    if (canvas.dataset.graphic === "map") cleanups.push(mapInteraction(host, svg, canvas));
    const observer = new ResizeObserver(scheduleDraw); observer.observe(host); draw();
    window.addEventListener("resize", scheduleDraw);
    void document.fonts.ready.then(scheduleDraw);
    cleanups.push(() => {
      disposed = true;
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleDraw);
      canvas.removeEventListener("contextlost", lost);
      canvas.removeEventListener("contextrestored", restored);
      canvas.remove(); host.querySelector(".graphic-tooltip")?.remove();
      svg.style.visibility = ""; if (smoothingNote) smoothingNote.hidden = true;
    });
  }
  return () => { for (const cleanup of cleanups) cleanup(); };
}
