import { describe, expect, it } from "vitest";
import { equityStatus } from "./equity";
import { addSeat, createTableState, placeCard, selectTarget } from "./table-state";
import { parseCardText, type Card } from "@/lib/poker/cards";

const c = (text: string): Card => {
  const card = parseCardText(text);
  if (card === null) throw new Error(`bad card ${text}`);
  return card;
};

describe("equityStatus", () => {
  it("waits for two seated players", () => {
    expect(equityStatus(createTableState())).toMatchObject({ kind: "waiting", message: "Seat at least two players to calculate." });
    const one = addSeat(createTableState(), "a", "p1");
    expect(equityStatus(one)).toMatchObject({ kind: "waiting" });
  });

  it("calculates with partly dealt seats, treating unknown cards as hidden", () => {
    let s = addSeat(addSeat(createTableState(), "a", "p1"), "b", "p2");
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("Ah"));
    expect(equityStatus(s).kind).toBe("ready");
  });

  it("is ready preflop, before any board card is dealt", () => {
    let s = addSeat(addSeat(createTableState(), "a", "p1"), "b", "p2");
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("Ah"));
    s = placeCard(s, c("Kh"));
    s = placeCard(s, c("2d"));
    s = placeCard(s, c("3d"));
    expect(equityStatus(s).kind).toBe("ready");
  });

  it("calculates for seats with cards but no named player", () => {
    let s = addSeat(addSeat(createTableState(), "a", null), "b", null);
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("Ah"));
    s = placeCard(s, c("Kh"));
    s = placeCard(s, c("2d"));
    s = placeCard(s, c("3d"));
    expect(equityStatus(s).kind).toBe("ready");
  });

  it("calculates for a named player who has no cards yet, with their cards hidden", () => {
    let s = addSeat(addSeat(createTableState(), "a", null), "b", "p2");
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("Ah"));
    s = placeCard(s, c("Kh"));
    expect(equityStatus(s).kind).toBe("ready");
  });

  it("waits when there are fewer than two seats in play", () => {
    expect(equityStatus(addSeat(createTableState(), "a", "p1"))).toMatchObject({ kind: "waiting" });
  });

  it("ignores empty seats, so they never block the calculation", () => {
    let s = addSeat(addSeat(createTableState(), "a", "p1"), "b", "p2");
    s = addSeat(s, "empty", null);
    s = selectTarget(s, { kind: "hole", seatId: "a", index: 0 });
    s = placeCard(s, c("Ah"));
    s = placeCard(s, c("Kh"));
    s = placeCard(s, c("2d"));
    s = placeCard(s, c("3d"));
    expect(equityStatus(s).kind).toBe("ready");
  });
});
