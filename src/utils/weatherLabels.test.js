import { describe, expect, it } from "vitest";
import {
  getAqiLabel,
  getDewpointLabel,
  getWindDirectionLabel,
  getWindArrowRotation,
  getUvLabel,
  getUvCondition,
} from "./weatherLabels";

describe("getAqiLabel", () => {
  it("returns an en dash for null", () => {
    expect(getAqiLabel(null)).toBe("–");
    expect(getAqiLabel(undefined)).toBe("–");
  });

  it.each([
    [0, "Good"],
    [50, "Good"],
    [51, "Moderate"],
    [100, "Moderate"],
    [150, "Unhealthy for Sensitive Groups"],
    [200, "Unhealthy"],
    [300, "Very Unhealthy"],
    [301, "Hazardous"],
  ])("maps AQI %i to %s", (aqi, label) => {
    expect(getAqiLabel(aqi)).toBe(label);
  });
});

describe("getDewpointLabel", () => {
  it("returns an en dash for null", () => {
    expect(getDewpointLabel(null)).toBe("–");
  });

  // Boundaries are exclusive upper bounds (`< 50`, `< 60`, ...).
  it.each([
    [49, "Dry"],
    [50, "Comfortable"],
    [59, "Comfortable"],
    [60, "Noticeable"],
    [64, "Noticeable"],
    [65, "Muggy"],
    [69, "Muggy"],
    [70, "Oppressive"],
  ])("maps dewpoint %i to %s", (dp, label) => {
    expect(getDewpointLabel(dp)).toBe(label);
  });
});

describe("getWindDirectionLabel", () => {
  it("returns an en dash for null", () => {
    expect(getWindDirectionLabel(null)).toBe("–");
  });

  it.each([
    [0, "N"],
    [45, "NE"],
    [90, "E"],
    [135, "SE"],
    [180, "S"],
    [225, "SW"],
    [270, "W"],
    [315, "NW"],
  ])("maps %i° to %s", (deg, label) => {
    expect(getWindDirectionLabel(deg)).toBe(label);
  });

  it("rounds to the nearest compass point and wraps past 337.5° back to N", () => {
    expect(getWindDirectionLabel(20)).toBe("N");
    expect(getWindDirectionLabel(25)).toBe("NE");
    expect(getWindDirectionLabel(350)).toBe("N");
    expect(getWindDirectionLabel(360)).toBe("N");
  });
});

describe("getWindArrowRotation", () => {
  it("returns null for null", () => {
    expect(getWindArrowRotation(null)).toBeNull();
  });

  it("flips the source direction 180° to point where the wind blows to", () => {
    expect(getWindArrowRotation(0)).toBe(180);
    expect(getWindArrowRotation(90)).toBe(270);
    expect(getWindArrowRotation(180)).toBe(0);
    expect(getWindArrowRotation(270)).toBe(90);
  });
});

describe("getUvLabel", () => {
  it.each([
    [0, "Low"],
    [2, "Low"],
    [3, "Moderate"],
    [5, "Moderate"],
    [6, "High"],
    [7, "High"],
    [8, "Very High"],
    [10, "Very High"],
    [11, "Extreme"],
  ])("maps UV %i to %s", (uv, label) => {
    expect(getUvLabel(uv)).toBe(label);
  });
});

describe("getUvCondition", () => {
  it("returns undefined for null", () => {
    expect(getUvCondition(null)).toBeUndefined();
  });

  it.each([
    [2, "good"],
    [5, "fair"],
    [7, "marginal"],
    [10, "poor"],
    [11, "bad"],
  ])("maps UV %i to condition %s", (uv, condition) => {
    expect(getUvCondition(uv)).toBe(condition);
  });
});
