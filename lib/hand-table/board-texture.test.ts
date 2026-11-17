import { describe, expect, it } from "vitest";
import { parseCardText, type Card } from "@/lib/poker/cards";
import { boardTexture } from "./board-texture";

const cards = (...codes: string[]): Card[] =>
  codes.map((code) => {
    const card = parseCardText(code);
    if (card === null) throw new Error(`bad card ${code}`);
    return card;
  });

describe("boardTexture", () => {
  it("is null before the flop", () => {
    expect(boardTexture(cards("Ks", "7d"))).toBeNull();
  });

  it("rates a disconnected rainbow board as dry", () => {
    const texture = boardTexture(cards("Ks", "7d", "2c"));
    expect(texture?.rating).toBe("dry");
    expect(texture?.points).toBe(0);
    expect(texture?.notes).toEqual(["Few suit or rank connections: the board is quiet"]);
  });

  it("flags a flush draw from three of one suit", () => {
    const texture = boardTexture(cards("Kh", "7h", "2h"));
    expect(texture?.notes.some((n) => n.includes("flush draw"))).toBe(true);
  });

  it("flags connected ranks as a straight draw", () => {
    const texture = boardTexture(cards("9h", "8d", "7c"));
    expect(texture?.notes.some((n) => n.includes("straight draw"))).toBe(true);
    expect(texture?.rating).toBe("semi-wet");
  });

  it("counts the ace as low for the wheel", () => {
    const texture = boardTexture(cards("As", "3d", "2c"));
    expect(texture?.notes.some((n) => n.includes("straight draw"))).toBe(true);
  });

  it("rates a board with suit and rank connections as wet", () => {
    const texture = boardTexture(cards("9h", "8h", "7h"));
    expect(texture?.rating).toBe("wet");
    // Straight: 2, flush: 2, combined: 1.
    expect(texture?.points).toBe(5);
  });

  it("does not call a two-tone board with two connected ranks dry", () => {
    const texture = boardTexture(cards("2s", "Ts", "Jd"));
    expect(texture?.rating).toBe("semi-wet");
    // Straight draw from T and J: 1. Two-tone: 1. Combined: 1.
    expect(texture?.points).toBe(3);
    expect(texture?.notes.some((n) => n.includes("Two connected ranks"))).toBe(true);
    expect(texture?.notes.some((n) => n.includes("Two-tone"))).toBe(true);
  });

  it("scores a three-suited board with no rank connection from the flush alone", () => {
    const texture = boardTexture(cards("Kh", "7h", "2h"));
    expect(texture?.points).toBe(2);
    expect(texture?.rating).toBe("semi-wet");
  });

  it("counts the wheel for an ace and a deuce", () => {
    const texture = boardTexture(cards("Ah", "9d", "2c"));
    expect(texture?.notes.some((n) => n.includes("Two connected ranks"))).toBe(true);
  });

  it("adds a point for a paired board", () => {
    const texture = boardTexture(cards("Kh", "Kd", "2c"));
    expect(texture?.notes.some((n) => n.includes("Paired"))).toBe(true);
  });
});
