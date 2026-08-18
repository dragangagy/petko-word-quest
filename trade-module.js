/**
 * G-Lab Trade — credits, shop catalog, and player-to-player avatar swaps.
 * Pure logic used by the Petko Word Quest UI and by Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.GlabTrade = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CLASSIC_WIN_CREDIT = 1;
  const CLASSIC_DAILY_CAP = 5;
  const COMPETITIVE_CREDIT_PER_LEVEL = 2;
  const CHALLENGE_WIN_CREDIT = 3;
  const CHALLENGE_PLAY_CREDIT = 1;
  const CHALLENGE_DAILY_CAP = 12;

  const SHOP_PRICES = {
    normal100: 12,
    tournament50: 18,
    challengeWins50: 22,
    streak5: 16,
    streak10: 28
  };

  const PENDING = "pending";
  const ACCEPTED = "accepted";
  const DECLINED = "declined";
  const CANCELLED = "cancelled";

  function emptyAwards() {
    return {
      classicDate: "",
      classicCount: 0,
      competitiveDate: "",
      competitiveAmount: 0,
      challengeDate: "",
      challengeAmount: 0,
      challengeCodes: {}
    };
  }

  function emptyState() {
    return {
      credits: 0,
      owned: [],
      listed: [],
      awards: emptyAwards(),
      offers: []
    };
  }

  function uniqueIds(values) {
    const seen = new Set();
    const next = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const id = String(value || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      next.push(id);
    });
    return next;
  }

  function cloneState(state) {
    const source = state && typeof state === "object" ? state : emptyState();
    const awards = { ...emptyAwards(), ...(source.awards || {}) };
    awards.challengeCodes = { ...(awards.challengeCodes || {}) };
    return {
      credits: Math.max(0, Number(source.credits) || 0),
      owned: uniqueIds(source.owned),
      listed: uniqueIds(source.listed).filter((id) => uniqueIds(source.owned).includes(id)),
      awards,
      offers: Array.isArray(source.offers) ? source.offers.map(normalizeOffer).filter(Boolean) : []
    };
  }

  function normalizeState(raw) {
    return cloneState(raw);
  }

  function normalizeOffer(row) {
    if (!row || typeof row !== "object") return null;
    const code = String(row.code || "").trim().toUpperCase();
    const offerer = String(row.offerer || "").trim();
    const receiver = String(row.receiver || "").trim();
    const offerAvatar = String(row.offerAvatar || row.offer_avatar || "").trim();
    const requestAvatar = String(row.requestAvatar || row.request_avatar || "").trim();
    const status = String(row.status || PENDING).trim() || PENDING;
    if (!code || !offerer || !receiver || !offerAvatar || !requestAvatar) return null;
    return {
      code,
      createdAt: String(row.createdAt || row.created_at || ""),
      offerer,
      offererDevice: String(row.offererDevice || row.offerer_device || ""),
      receiver,
      receiverDevice: String(row.receiverDevice || row.receiver_device || ""),
      offerAvatar,
      requestAvatar,
      status
    };
  }

  function sameName(left, right) {
    return String(left || "").trim().toLocaleLowerCase("en-US") === String(right || "").trim().toLocaleLowerCase("en-US");
  }

  function isWeekendAvatar(avatar = {}) {
    return Boolean(avatar.weekendWitch || avatar.unlockGroup === "weekendWitch");
  }

  function isTradableAvatar(avatar = {}) {
    if (!avatar || !avatar.id || avatar.adminOnly) return false;
    if (!avatar.unlockGroup) return false;
    return !isWeekendAvatar(avatar);
  }

  function priceFor(avatar = {}) {
    if (!isTradableAvatar(avatar)) return 0;
    return SHOP_PRICES[avatar.unlockGroup] || 0;
  }

  function owns(state, avatarId) {
    return cloneState(state).owned.includes(String(avatarId || "").trim());
  }

  function listed(state, avatarId) {
    return cloneState(state).listed.includes(String(avatarId || "").trim());
  }

  function creditKey(kind, date, extra) {
    return [kind, date, extra].filter((part) => part !== undefined && part !== "").join(":");
  }

  function addCredits(state, amount) {
    const next = cloneState(state);
    next.credits += Math.max(0, Number(amount) || 0);
    return next;
  }

  function awardClassicWin(state, date) {
    const next = cloneState(state);
    if (next.awards.classicDate !== date) {
      next.awards.classicDate = date;
      next.awards.classicCount = 0;
    }
    if (next.awards.classicCount >= CLASSIC_DAILY_CAP) {
      return { awarded: 0, state: next, reason: "Classic credit cap reached for today." };
    }
    next.awards.classicCount += 1;
    next.credits += CLASSIC_WIN_CREDIT;
    return { awarded: CLASSIC_WIN_CREDIT, state: next };
  }

  function awardCompetitiveFinish(state, date, completedLevels) {
    const next = cloneState(state);
    const levels = Math.max(0, Math.min(4, Number(completedLevels) || 0));
    const amount = levels * COMPETITIVE_CREDIT_PER_LEVEL;
    if (next.awards.competitiveDate === date) {
      return { awarded: 0, state: next, reason: "Competitive credits already counted today." };
    }
    next.awards.competitiveDate = date;
    next.awards.competitiveAmount = amount;
    next.credits += amount;
    return { awarded: amount, state: next };
  }

  function awardChallengeResult(state, date, code, won) {
    const next = cloneState(state);
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) return { awarded: 0, state: next, reason: "Missing challenge." };
    if (next.awards.challengeCodes[cleanCode]) {
      return { awarded: 0, state: next, reason: "This challenge already paid credits." };
    }
    if (next.awards.challengeDate !== date) {
      next.awards.challengeDate = date;
      next.awards.challengeAmount = 0;
    }
    const amount = won ? CHALLENGE_WIN_CREDIT : CHALLENGE_PLAY_CREDIT;
    if (next.awards.challengeAmount + amount > CHALLENGE_DAILY_CAP) {
      return { awarded: 0, state: next, reason: "Challenge credit cap reached for today." };
    }
    next.awards.challengeCodes[cleanCode] = true;
    next.awards.challengeAmount += amount;
    next.credits += amount;
    return { awarded: amount, state: next };
  }

  function buy(state, avatar) {
    const next = cloneState(state);
    if (!isTradableAvatar(avatar)) {
      return { ok: false, state: next, error: "This avatar is not in the G-Lab catalog." };
    }
    const price = priceFor(avatar);
    if (!price) return { ok: false, state: next, error: "This avatar has no trade price." };
    if (owns(next, avatar.id)) return { ok: false, state: next, error: "You already own a tradable copy." };
    if (next.credits < price) return { ok: false, state: next, error: `Need ${price} G-Lab credits.` };
    next.credits -= price;
    next.owned.push(avatar.id);
    return { ok: true, state: next, price };
  }

  function setListed(state, avatarId, wantListed) {
    const next = cloneState(state);
    const id = String(avatarId || "").trim();
    if (!owns(next, id)) return { ok: false, state: next, error: "Only tradable copies can be listed." };
    if (wantListed) {
      if (!next.listed.includes(id)) next.listed.push(id);
    } else {
      next.listed = next.listed.filter((item) => item !== id);
    }
    return { ok: true, state: next };
  }

  function toggleListed(state, avatarId) {
    return setListed(state, avatarId, !listed(state, avatarId));
  }

  function offerCode() {
    return Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 8).toUpperCase();
  }

  function createOffer(state, details = {}) {
    const next = cloneState(state);
    const offer = normalizeOffer({
      ...details,
      code: details.code || offerCode(),
      status: PENDING,
      createdAt: details.createdAt || new Date().toISOString()
    });
    if (!offer) return { ok: false, state: next, error: "Trade offer is incomplete." };
    if (sameName(offer.offerer, offer.receiver)) {
      return { ok: false, state: next, error: "You cannot trade with yourself." };
    }
    if (offer.offerAvatar === offer.requestAvatar) {
      return { ok: false, state: next, error: "Pick two different avatars." };
    }
    if (!owns(next, offer.offerAvatar)) {
      return { ok: false, state: next, error: "You can only offer a tradable copy you own." };
    }
    next.offers = next.offers.filter((row) => row.code !== offer.code);
    next.offers.unshift(offer);
    return { ok: true, state: next, offer };
  }

  function upsertOffer(state, offer) {
    const next = cloneState(state);
    const clean = normalizeOffer(offer);
    if (!clean) return next;
    next.offers = [clean, ...next.offers.filter((row) => row.code !== clean.code)];
    return next;
  }

  function findOffer(state, code) {
    const clean = String(code || "").trim().toUpperCase();
    return cloneState(state).offers.find((row) => row.code === clean) || null;
  }

  function setOfferStatus(state, code, status) {
    const next = cloneState(state);
    const clean = String(code || "").trim().toUpperCase();
    next.offers = next.offers.map((row) => (row.code === clean ? { ...row, status } : row));
    return next;
  }

  function transferAvatar(owned, fromId, toId) {
    const next = uniqueIds(owned).filter((id) => id !== fromId);
    if (toId && !next.includes(toId)) next.push(toId);
    return next;
  }

  function applyAcceptedSwap(offererState, receiverState, offer) {
    const offerer = cloneState(offererState);
    const receiver = cloneState(receiverState);
    const clean = normalizeOffer(offer);
    if (!clean) return { ok: false, offererState: offerer, receiverState: receiver, error: "Invalid trade." };
    if (!owns(offerer, clean.offerAvatar)) {
      return { ok: false, offererState: offerer, receiverState: receiver, error: "The offered avatar is no longer owned." };
    }
    if (!owns(receiver, clean.requestAvatar)) {
      return { ok: false, offererState: offerer, receiverState: receiver, error: "The requested avatar is no longer owned." };
    }
    offerer.owned = transferAvatar(offerer.owned, clean.offerAvatar, clean.requestAvatar);
    receiver.owned = transferAvatar(receiver.owned, clean.requestAvatar, clean.offerAvatar);
    offerer.listed = offerer.listed.filter((id) => offerer.owned.includes(id));
    receiver.listed = receiver.listed.filter((id) => receiver.owned.includes(id));
    offerer.offers = offerer.offers.map((row) => (row.code === clean.code ? { ...row, status: ACCEPTED } : row));
    receiver.offers = receiver.offers.map((row) => (row.code === clean.code ? { ...row, status: ACCEPTED } : row));
    if (!receiver.offers.some((row) => row.code === clean.code)) {
      receiver.offers.unshift({ ...clean, status: ACCEPTED });
    }
    if (!offerer.offers.some((row) => row.code === clean.code)) {
      offerer.offers.unshift({ ...clean, status: ACCEPTED });
    }
    return { ok: true, offererState: offerer, receiverState: receiver };
  }

  function acceptOffer(myState, theirState, offer, myName) {
    const clean = normalizeOffer(offer);
    if (!clean) return { ok: false, myState: cloneState(myState), theirState: cloneState(theirState), error: "Invalid trade." };
    if (!sameName(myName, clean.receiver)) {
      return { ok: false, myState: cloneState(myState), theirState: cloneState(theirState), error: "Only the receiving player can accept." };
    }
    if (clean.status !== PENDING) {
      return { ok: false, myState: cloneState(myState), theirState: cloneState(theirState), error: "This trade is no longer pending." };
    }
    const swapped = applyAcceptedSwap(theirState, myState, clean);
    if (!swapped.ok) {
      return { ok: false, myState: cloneState(myState), theirState: cloneState(theirState), error: swapped.error };
    }
    return { ok: true, myState: swapped.receiverState, theirState: swapped.offererState };
  }

  function incomingPending(state, myName) {
    return cloneState(state).offers.filter((row) => row.status === PENDING && sameName(row.receiver, myName));
  }

  function outgoingPending(state, myName) {
    return cloneState(state).offers.filter((row) => row.status === PENDING && sameName(row.offerer, myName));
  }

  function shopItem(avatar, state, earned) {
    const tradable = isTradableAvatar(avatar);
    const price = priceFor(avatar);
    const ownedCopy = owns(state, avatar.id);
    return {
      id: avatar.id,
      label: avatar.label,
      src: avatar.src,
      group: avatar.group,
      unlockGroup: avatar.unlockGroup,
      tradable,
      weekend: isWeekendAvatar(avatar),
      price,
      owned: ownedCopy,
      earned: Boolean(earned),
      listed: listed(state, avatar.id),
      canBuy: tradable && !ownedCopy && cloneState(state).credits >= price && price > 0,
      canList: ownedCopy
    };
  }

  return {
    CLASSIC_WIN_CREDIT,
    CLASSIC_DAILY_CAP,
    COMPETITIVE_CREDIT_PER_LEVEL,
    CHALLENGE_WIN_CREDIT,
    CHALLENGE_PLAY_CREDIT,
    CHALLENGE_DAILY_CAP,
    SHOP_PRICES,
    PENDING,
    ACCEPTED,
    DECLINED,
    CANCELLED,
    emptyState,
    normalizeState,
    cloneState,
    normalizeOffer,
    sameName,
    isWeekendAvatar,
    isTradableAvatar,
    priceFor,
    owns,
    listed,
    creditKey,
    addCredits,
    awardClassicWin,
    awardCompetitiveFinish,
    awardChallengeResult,
    buy,
    setListed,
    toggleListed,
    offerCode,
    createOffer,
    upsertOffer,
    findOffer,
    setOfferStatus,
    applyAcceptedSwap,
    acceptOffer,
    incomingPending,
    outgoingPending,
    shopItem
  };
});
