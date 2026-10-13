import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const squads = JSON.parse(fs.readFileSync(path.join(root, "data/squads/fictional-league.json"), "utf8"));
const write = process.argv.includes("--write");
for (const folder of ["data/samples", "data/scenarios"]) {
  for (const filename of fs.readdirSync(path.join(root, folder)).filter(name => name.endsWith(".json") && !name.endsWith(".script.json"))) {
    const relative = `${folder}/${filename}`, target = path.join(root, relative);
    const original = fs.readFileSync(target, "utf8"), replay = JSON.parse(original);
    const identities = new Map();
    for (const player of replay.match.players) {
      const squad = squads.teams.find(team => team.id === player.teamId);
      const canonical = squad?.players.find(member => member.number === player.number);
      assert.ok(canonical, `${relative}: unknown squad number ${player.teamId}/${player.number}`);
      identities.set(player.id, canonical.id);
      Object.assign(player, { id: canonical.id, name: canonical.name, number: canonical.number });
    }
    assert.equal(new Set(replay.match.players.map(player => player.id)).size, replay.match.players.length, `${relative}: duplicate canonical player`);
    const remap = id => {
      assert.ok(identities.has(id), `${relative}: unknown reference ${id}`);
      return identities.get(id);
    };
    for (const event of replay.events) {
      event.actorId = remap(event.actorId);
      if (event.recipientId) event.recipientId = remap(event.recipientId);
    }
    for (const frame of replay.tracking) for (const player of frame.players) player.playerId = remap(player.playerId);
    const expected = JSON.parse(original);
    if (JSON.stringify(expected) === JSON.stringify(replay)) {
      console.log(`PASS ${relative}`);
    } else if (write) {
      const newline = original.includes("\r\n") ? "\r\n" : "\n";
      fs.writeFileSync(target, (JSON.stringify(replay, null, 2) + "\n").replace(/\n/g, newline));
      console.log(`RECONCILED ${relative}`);
    } else {
      throw new Error(`${relative}: roster drift; review then run with --write`);
    }
  }
}
