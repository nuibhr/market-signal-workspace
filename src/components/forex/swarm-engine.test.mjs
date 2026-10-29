import test from "node:test";
import assert from "node:assert/strict";
import { SWARM_AGENTS, runSwarmDebate } from "./swarm-engine.mjs";
import { demoBars } from "./terminal-demo.mjs";
import { resolveInitialInstrument } from "./symbol-universe.mjs";

const initialInstrument = resolveInitialInstrument("XAU/USD");

test("SWARM_AGENTS defines exactly 6 distinct specialized agents with colors and roles", () => {
  assert.equal(SWARM_AGENTS.length, 6);
  const ids = SWARM_AGENTS.map((a) => a.id);
  assert.deepEqual(ids, ["spotter", "edge", "prior", "kelly", "taker", "closer"]);

  for (const agent of SWARM_AGENTS) {
    assert.ok(agent.name);
    assert.ok(agent.role);
    assert.ok(agent.color.startsWith("#"));
    assert.ok(agent.glow);
    assert.ok(agent.title);
  }
});

test("runSwarmDebate rejects invalid or insufficient bars safely", () => {
  assert.equal(runSwarmDebate(null), null);
  assert.equal(runSwarmDebate([]), null);
  assert.equal(runSwarmDebate(Array(10).fill({ close: 2600 })), null);
});

test("runSwarmDebate executes full 6-agent debate and outputs actionable consensus", () => {
  const bars = demoBars(initialInstrument, "15m").slice(0, 60);
  const result = runSwarmDebate(bars, "15m", "2000");

  assert.ok(result);
  assert.ok(["BUY", "SELL", "STAND_ASIDE"].includes(result.consensus));
  assert.ok(result.confidence >= 50 && result.confidence <= 100);
  assert.ok(["A+", "A", "B", "NEUTRAL"].includes(result.grade));

  // Verify dialogue has all 6 agents participating in sequence
  assert.equal(result.dialogue.length, 6);
  assert.equal(result.dialogue[0].sender, "spotter");
  assert.equal(result.dialogue[1].sender, "edge");
  assert.equal(result.dialogue[2].sender, "prior");
  assert.equal(result.dialogue[3].sender, "kelly");
  assert.equal(result.dialogue[4].sender, "taker");
  assert.equal(result.dialogue[5].sender, "closer");

  // Verify metrics & Kelly Sizing
  assert.ok(Number(result.metrics.atr) > 0);
  assert.ok(Number(result.metrics.recommendedLot) > 0);
  assert.ok(result.metrics.recommendedRiskPercent <= 2.0);

  // Verify plan compatibility with Studio
  assert.ok(result.plan.title.includes("มติสภา AI Swarm"));
  assert.ok(Number(result.plan.entry) > 0);
  assert.ok(Number(result.plan.stop) > 0);
  assert.ok(Number(result.plan.target) > 0);
  assert.equal(result.plan.balance, "2000");

  // Verify synapses count
  assert.equal(result.synapses.length, 6);
});

test("runSwarmDebate adapts dynamically to 1h timeframe", () => {
  const bars = demoBars(initialInstrument, "1h").slice(0, 80);
  const result = runSwarmDebate(bars, "1h", "5000");

  assert.ok(result);
  assert.equal(result.timeframe, "1h");
  assert.equal(result.plan.balance, "5000");
  assert.ok(Number(result.metrics.recommendedRiskPercent) > 0);
});
