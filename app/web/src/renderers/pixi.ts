import { Application, Container, Graphics, Text } from "pixi.js";
import type { PitchRenderer, RenderPlayer, SceneState } from "./types";

export async function createPixi(host: HTMLElement, players: RenderPlayer[]): Promise<PitchRenderer> {
  const app = new Application();
  await app.init({ width: host.clientWidth, height: host.clientHeight, antialias: true,
    resolution: Math.min(devicePixelRatio, 2), autoDensity: true, background: "#102e25",
    preference: "webgl", preserveDrawingBuffer: true });
  host.append(app.canvas);
  app.canvas.setAttribute("aria-label", "Tactical pitch with animated players and ball");
  app.canvas.setAttribute("role", "img");
  app.ticker.stop();
  const world = new Container();
  app.stage.addChild(world);
  const turf = new Graphics().rect(-4, -4, 113, 76).fill(0x174934);
  for (let i = 0; i < 10; i++) turf.rect(i * 10.5, 0, 10.5, 68).fill(i % 2 ? 0x286a49 : 0x246244);
  world.addChild(turf);
  const lines = new Graphics();
  lines.rect(0, 0, 105, 68).moveTo(52.5, 0).lineTo(52.5, 68).circle(52.5, 34, 9.15);
  lines.rect(0, 13.84, 16.5, 40.32).rect(88.5, 13.84, 16.5, 40.32);
  lines.rect(0, 24.84, 5.5, 18.32).rect(99.5, 24.84, 5.5, 18.32);
  lines.rect(-2, 30.34, 2, 7.32).rect(105, 30.34, 2, 7.32);
  lines.stroke({ color: 0xdae7d6, width: 0.22, alpha: 0.8 });
  lines.circle(11, 34, .22).circle(94, 34, .22).circle(52.5, 34, .22).fill(0xdae7d6);
  world.addChild(lines);
  const path = new Graphics();
  world.addChild(path);
  const tokens = new Map<string, Container>();
  for (const player of players) {
    const token = new Container();
    const color = player.home ? 0xf47761 : 0x48bed3;
    token.addChild(new Graphics().circle(.22, .35, 1.8).fill({ color: 0x071b13, alpha: .35 }));
    token.addChild(new Graphics().circle(0, 0, 1.65).fill(color).stroke({ color: 0xffffff, width: .24 }));
    const label = new Text({ text: String(player.number), style: { fontFamily: "Arial", fontSize: 32, fontWeight: "bold", fill: 0x10231c }, resolution: 2 });
    label.anchor.set(.5);
    label.scale.set(.065);
    token.addChild(label);
    world.addChild(token);
    tokens.set(player.id, token);
  }
  const ball = new Graphics().circle(0, 0, .72).fill(0xfff7df).stroke({ color: 0x11271d, width: .16 });
  world.addChild(ball);
  const resize = (): void => {
    app.renderer.resize(host.clientWidth, host.clientHeight);
    const scale = Math.min(host.clientWidth / 117, host.clientHeight / 80);
    world.scale.set(scale);
    world.position.set((host.clientWidth - 105 * scale) / 2, (host.clientHeight - 68 * scale) / 2);
    app.render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  return {
    update(state) {
      for (const [id, point] of state.players) tokens.get(id)?.position.set(point.x, 68 - point.y);
      ball.position.set(state.ball.x, 68 - state.ball.y);
      path.clear();
      if (state.path) {
        const a = state.path.from, b = state.path.to;
        path.moveTo(a.x, 68 - a.y).lineTo(b.x, 68 - b.y).stroke({ color: 0xe7f39c, width: .45, alpha: .85 });
        const angle = Math.atan2(-(b.y - a.y), b.x - a.x);
        path.moveTo(b.x - 2 * Math.cos(angle - .45), 68 - b.y - 2 * Math.sin(angle - .45))
          .lineTo(b.x, 68 - b.y).lineTo(b.x - 2 * Math.cos(angle + .45), 68 - b.y - 2 * Math.sin(angle + .45))
          .stroke({ color: 0xe7f39c, width: .45 });
      }
    },
    draw() { app.render(); },
    resetCamera() { resize(); },
    destroy() { observer.disconnect(); app.destroy(true, { children: true }); },
  };
}
