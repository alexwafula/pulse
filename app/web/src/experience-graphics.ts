type Graphic = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; svg: SVGSVGElement; host: HTMLElement };
const number = (element: Element, attribute: string): number => Number(element.getAttribute(attribute));

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

function mapInteraction(graphic: Graphic): void {
  const {canvas, svg, host} = graphic;
  const tooltip = document.createElement("span"); tooltip.className = "graphic-tooltip"; tooltip.hidden = true;
  tooltip.setAttribute("role","tooltip"); host.append(tooltip);
  let selectedEvent: string | undefined;
  canvas.addEventListener("pointermove", event => {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX-bounds.left)/bounds.width*109-2;
    const y = (event.clientY-bounds.top)/bounds.height*72-2;
    let text: string | undefined; selectedEvent = undefined;
    if (host.dataset.mapMode === "occupancy") {
      const cell = Array.from(svg.querySelectorAll<SVGRectElement>(".heat-cells rect")).find(cell => x >= number(cell,"x") && x < number(cell,"x")+5 && y >= number(cell,"y") && y < number(cell,"y")+4);
      text = cell?.querySelector("title")?.textContent ?? undefined;
    } else if (host.dataset.mapMode === "network") {
      const node = Array.from(svg.querySelectorAll<SVGGElement>(".network-node")).find(node => Math.hypot(x-number(node,"data-x"),y-number(node,"data-y")) <= number(node,"data-radius"));
      text = node?.querySelector("title")?.textContent ?? undefined;
    } else {
      const point = Array.from(svg.querySelectorAll<SVGCircleElement>(".shot-points circle")).find(point => Math.hypot(x-number(point,"cx"),y-number(point,"cy")) <= 3);
      text = point?.querySelector("title")?.textContent ?? undefined;
      selectedEvent = point?.dataset.shotEvent;
    }
    tooltip.hidden = !text; tooltip.textContent = text ?? "";
    canvas.style.cursor = selectedEvent ? "pointer" : "default";
  });
  canvas.addEventListener("pointerleave", () => { tooltip.hidden = true; selectedEvent = undefined; });
  canvas.addEventListener("click", event => {
    if (host.dataset.mapMode !== "shots") return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX-bounds.left)/bounds.width*109-2, y = (event.clientY-bounds.top)/bounds.height*72-2;
    const point = Array.from(svg.querySelectorAll<SVGCircleElement>(".shot-points circle")).find(point => Math.hypot(x-number(point,"cx"),y-number(point,"cy")) <= 3);
    if (point?.dataset.shotEvent) document.dispatchEvent(new CustomEvent("pulse:map-inspect", {detail: {eventId: point.dataset.shotEvent}}));
  });
}

// Repaint only presentation paths/cells supplied by Go. No football calculations.
export function paintExperienceGraphics(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  for (const host of root.querySelectorAll<HTMLElement>(".chart-art, .map-art")) {
    const svg = host.querySelector<SVGSVGElement>("svg")!;
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (!context || typeof Path2D === "undefined") continue;
    canvas.className = "experience-graphic";
    canvas.setAttribute("role","img"); canvas.setAttribute("aria-label",svg.getAttribute("aria-label")!);
    canvas.dataset.graphic = host.classList.contains("map-art") ? "map" : "chart";
    const graphic = {canvas, context, svg, host};
    function draw(): void {
      if (!host.isConnected || host.clientWidth === 0 || host.clientHeight === 0) return;
      const width = host.clientWidth, height = host.clientHeight, dpr = Math.min(devicePixelRatio || 1,2);
      canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
      if (canvas.dataset.graphic === "map") {
        context!.setTransform(canvas.width/109,0,0,canvas.height/72,canvas.width/109*2,canvas.height/72*2);
        drawMap(graphic);
      } else {
        context!.setTransform(canvas.width/280,0,0,canvas.height/100,0,0);
        drawChart(graphic);
      }
    }
    host.append(canvas); svg.style.visibility = "hidden";
    const smoothingNote = host.closest(".experience-map")?.querySelector<HTMLElement>(".smoothed-note");
    if (smoothingNote) smoothingNote.hidden = false;
    if (canvas.dataset.graphic === "map") mapInteraction(graphic);
    const observer = new ResizeObserver(draw); observer.observe(host); draw();
    void document.fonts.ready.then(draw);
    cleanups.push(() => { observer.disconnect(); canvas.remove(); host.querySelector(".graphic-tooltip")?.remove(); svg.style.visibility = ""; if (smoothingNote) smoothingNote.hidden = true; });
  }
  return () => { for (const cleanup of cleanups) cleanup(); };
}
