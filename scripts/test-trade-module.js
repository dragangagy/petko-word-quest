#!/usr/bin/env node
const assert = require("assert");
const GlabTrade = require("../trade-module.js");

function avatar(id, unlockGroup) {
  return { id, label: id, src: `${id}.png`, group: "male", unlockGroup };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok ${passed} ${name}`);
}

test("empty state starts with zero credits", () => {
  const state = GlabTrade.emptyState();
  assert.strictEqual(state.credits, 0);
  assert.deepStrictEqual(state.owned, []);
});

test("classic wins award credits up to the daily cap", () => {
  let state = GlabTrade.emptyState();
  for (let i = 0; i < 5; i += 1) {
    const result = GlabTrade.awardClassicWin(state, "2026-08-18");
    assert.strictEqual(result.awarded, 1);
    state = result.state;
  }
  const capped = GlabTrade.awardClassicWin(state, "2026-08-18");
  assert.strictEqual(capped.awarded, 0);
  assert.strictEqual(capped.state.credits, 5);
  const nextDay = GlabTrade.awardClassicWin(capped.state, "2026-08-19");
  assert.strictEqual(nextDay.awarded, 1);
});

test("competitive finish pays once per day", () => {
  let result = GlabTrade.awardCompetitiveFinish(GlabTrade.emptyState(), "2026-08-18", 4);
  assert.strictEqual(result.awarded, 8);
  result = GlabTrade.awardCompetitiveFinish(result.state, "2026-08-18", 4);
  assert.strictEqual(result.awarded, 0);
});

test("challenge results are unique per code and capped", () => {
  let state = GlabTrade.emptyState();
  const win = GlabTrade.awardChallengeResult(state, "2026-08-18", "ABC123", true);
  assert.strictEqual(win.awarded, 3);
  const again = GlabTrade.awardChallengeResult(win.state, "2026-08-18", "ABC123", true);
  assert.strictEqual(again.awarded, 0);
  const loss = GlabTrade.awardChallengeResult(win.state, "2026-08-18", "DEF456", false);
  assert.strictEqual(loss.awarded, 1);
});

test("shop rejects weekend avatars and poor balances", () => {
  const witch = avatar("female-41", "weekendWitch");
  witch.weekendWitch = true;
  const locked = GlabTrade.buy(GlabTrade.emptyState(), witch);
  assert.strictEqual(locked.ok, false);
  const hunter = avatar("male-31", "challengeWins50");
  const poor = GlabTrade.buy(GlabTrade.emptyState(), hunter);
  assert.strictEqual(poor.ok, false);
});

test("buying spends credits and listing requires ownership", () => {
  const hunter = avatar("male-31", "challengeWins50");
  let state = GlabTrade.addCredits(GlabTrade.emptyState(), 30);
  const bought = GlabTrade.buy(state, hunter);
  assert.strictEqual(bought.ok, true);
  assert.strictEqual(bought.state.credits, 8);
  assert.ok(GlabTrade.owns(bought.state, "male-31"));
  const listed = GlabTrade.toggleListed(bought.state, "male-31");
  assert.strictEqual(listed.ok, true);
  assert.ok(GlabTrade.listed(listed.state, "male-31"));
  const missing = GlabTrade.toggleListed(GlabTrade.emptyState(), "male-31");
  assert.strictEqual(missing.ok, false);
});

test("accepted swap exchanges owned copies", () => {
  const offerAvatar = avatar("male-21", "normal100");
  const requestAvatar = avatar("female-21", "normal100");
  let offerer = GlabTrade.buy(GlabTrade.addCredits(GlabTrade.emptyState(), 20), offerAvatar).state;
  let receiver = GlabTrade.buy(GlabTrade.addCredits(GlabTrade.emptyState(), 20), requestAvatar).state;
  offerer = GlabTrade.toggleListed(offerer, "male-21").state;
  receiver = GlabTrade.toggleListed(receiver, "female-21").state;
  const created = GlabTrade.createOffer(offerer, {
    code: "TRADE1",
    offerer: "Ana",
    receiver: "Petko",
    offerAvatar: "male-21",
    requestAvatar: "female-21"
  });
  assert.strictEqual(created.ok, true);
  const accepted = GlabTrade.acceptOffer(receiver, created.state, created.offer, "Petko");
  assert.strictEqual(accepted.ok, true);
  assert.ok(GlabTrade.owns(accepted.myState, "male-21"));
  assert.ok(!GlabTrade.owns(accepted.myState, "female-21"));
  assert.ok(GlabTrade.owns(accepted.theirState, "female-21"));
  assert.ok(!GlabTrade.owns(accepted.theirState, "male-21"));
  assert.ok(!GlabTrade.listed(accepted.myState, "female-21"));
});

test("self trades and missing ownership are rejected", () => {
  const self = GlabTrade.createOffer(GlabTrade.emptyState(), {
    offerer: "Ana",
    receiver: "ana",
    offerAvatar: "male-21",
    requestAvatar: "female-21"
  });
  assert.strictEqual(self.ok, false);
  const offer = GlabTrade.normalizeOffer({
    code: "X",
    offerer: "Ana",
    receiver: "Petko",
    offerAvatar: "male-21",
    requestAvatar: "female-21",
    status: "pending"
  });
  const bad = GlabTrade.acceptOffer(GlabTrade.emptyState(), GlabTrade.emptyState(), offer, "Petko");
  assert.strictEqual(bad.ok, false);
});

console.log(`\n${passed} trade-module tests passed.`);
