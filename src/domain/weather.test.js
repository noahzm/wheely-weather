import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluateWind,
  getOverallStatus,
  isThunderstorm,
  getAqiLabel,
  getDewpointLabel,
  getWindArrowRotation,
  getRainTiming,
  getDailyCondition,
  getMessage,
  getWeatherAlerts,
  getGearSuggestion,
  getRideFactors,
  getBestRideWindow,
} from "./weather";
import {
  getBestDayInfo,
  getBestDaysBlurb,
  getDayConditionReason,
} from "../utils/forecastHelpers";

describe("Weather Condition Evaluation", () => {
  it("evaluates temperature (feelsLike) correctly", () => {
    expect(evaluateCondition(75, "feelsLike")).toBe("good");
    expect(evaluateCondition(55, "feelsLike")).toBe("good"); // 55 is > 50, so it's good
    expect(evaluateCondition(49, "feelsLike")).toBe("fair"); // < 50 is fair
    expect(evaluateCondition(44, "feelsLike")).toBe("marginal"); // < 45 is marginal
    expect(evaluateCondition(35, "feelsLike")).toBe("poor");
    expect(evaluateCondition(30, "feelsLike")).toBe("bad");
  });

  it("rates the hot side of feels-like more aggressively than the cold side", () => {
    expect(evaluateCondition(84, "feelsLike")).toBe("good"); // top of good
    expect(evaluateCondition(86, "feelsLike")).toBe("fair"); // > 84 is fair
    expect(evaluateCondition(90, "feelsLike")).toBe("marginal"); // > 88 is marginal
    expect(evaluateCondition(94, "feelsLike")).toBe("poor"); // > 92 is poor
    expect(evaluateCondition(96, "feelsLike")).toBe("bad"); // > 95 is bad
  });

  it("evaluates windSpeed correctly", () => {
    expect(evaluateCondition(5, "windSpeed")).toBe("good");
    expect(evaluateCondition(13, "windSpeed")).toBe("fair");
    expect(evaluateCondition(16, "windSpeed")).toBe("marginal");
    expect(evaluateCondition(19, "windSpeed")).toBe("poor");
    expect(evaluateCondition(25, "windSpeed")).toBe("bad");
  });

  it("evaluates windGust on its own (higher) thresholds", () => {
    expect(evaluateCondition(18, "windGust")).toBe("good");
    expect(evaluateCondition(22, "windGust")).toBe("fair");
    expect(evaluateCondition(28, "windGust")).toBe("marginal");
    expect(evaluateCondition(34, "windGust")).toBe("poor");
    expect(evaluateCondition(40, "windGust")).toBe("bad");
  });

  it("rates wind on the worse of sustained speed and gusts", () => {
    // Calm sustained wind but strong gusts is still flagged.
    expect(evaluateWind(8, 34)).toBe("poor");
    // Gusts absent -> falls back to sustained-only.
    expect(evaluateWind(16, null)).toBe("marginal");
    // Sustained worse than gusts -> sustained wins.
    expect(evaluateWind(22, 24)).toBe("bad");
  });

  it("evaluates rainChance correctly", () => {
    expect(evaluateCondition(0, "rainChance")).toBe("good");
    expect(evaluateCondition(20, "rainChance")).toBe("fair");
    expect(evaluateCondition(35, "rainChance")).toBe("marginal");
    expect(evaluateCondition(50, "rainChance")).toBe("poor");
    expect(evaluateCondition(70, "rainChance")).toBe("bad");
  });

  it("evaluates aqi correctly", () => {
    expect(evaluateCondition(20, "aqi")).toBe("good");
    expect(evaluateCondition(80, "aqi")).toBe("fair");
    expect(evaluateCondition(110, "aqi")).toBe("marginal");
    expect(evaluateCondition(140, "aqi")).toBe("poor");
    expect(evaluateCondition(160, "aqi")).toBe("bad");
  });
});

describe("Overall Status Determination", () => {
  it('returns "no" for thunderstorms', () => {
    const weather = { hasThunderstorms: true };
    expect(getOverallStatus(weather)).toBe("no");
  });

  it('returns "no" if any condition is "bad" or "poor"', () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 30, // bad
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe("no");
  });

  it('returns "no" when the weather code is severe even if raw metrics look fine', () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 10, // below marginal threshold
      dewpoint: 50,
      aqi: 20,
      weatherCode: 65, // heavy rain
    };
    expect(getOverallStatus(weather)).toBe("no");
  });

  it('returns "maybe" if conditions are "marginal" or "fair"', () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 75, // good
      windSpeed: 13, // fair
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe("maybe");
  });

  it('returns "yes" if all conditions are "good"', () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 75,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe("yes");
  });
});

describe("Weather Utilities", () => {
  it("identifies thunderstorms correctly", () => {
    expect(isThunderstorm(95)).toBe(true);
    expect(isThunderstorm(96)).toBe(true);
    expect(isThunderstorm(99)).toBe(true);
    expect(isThunderstorm(3)).toBe(false);
  });

  it("provides correct AQI labels", () => {
    expect(getAqiLabel(25)).toBe("Good");
    expect(getAqiLabel(75)).toBe("Moderate");
    expect(getAqiLabel(125)).toBe("Unhealthy for Sensitive Groups");
  });

  it("provides correct Dewpoint labels", () => {
    expect(getDewpointLabel(45)).toBe("Dry");
    expect(getDewpointLabel(55)).toBe("Comfortable");
    expect(getDewpointLabel(75)).toBe("Oppressive");
  });

  it("flips wind direction for arrow rotation", () => {
    expect(getWindArrowRotation(0)).toBe(180);
    expect(getWindArrowRotation(90)).toBe(270);
    expect(getWindArrowRotation(225)).toBe(45);
    expect(getWindArrowRotation(null)).toBeNull();
  });
});

describe("Hourly Message Logic", () => {
  it("uses a natural weather phrase in the good-ride summary", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 68,
      windSpeed: 6,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      condition: "Clear skies",
      hourly: [{ hour: 10, condition: "good" }],
    };

    expect(getMessage(weather, "yes")).toBe(
      "Ideal ride conditions. 68°F, clear skies, and light winds.",
    );
  });

  it("mentions when conditions become fair later even if they never reach fully good", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 33,
      windSpeed: 6,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      hourly: [
        { hour: 10, condition: "bad" },
        { hour: 11, condition: "fair" },
        { hour: 12, condition: "fair" },
      ],
    };

    expect(getMessage(weather, "no")).toContain("Clears by 11am");
  });

  it("does not call mild weather too hot when the real issue is wind", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 70,
      windSpeed: 22,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: "bad" }],
    };

    const message = getMessage(weather, "no");

    expect(message).toContain("heavy wind");
    expect(message).not.toContain("too hot (70°F)");
  });

  it("formats multiple issues as a readable sentence", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 66,
      aqi: 80,
      hourly: [{ hour: 10, condition: "fair" }],
    };

    expect(getMessage(weather, "maybe")).toBe(
      "Rideable. But it’s cold (48°F), gusty (13 mph), rainy (35% chance), sticky (dew 66°F), and hazy (AQI 80).",
    );
  });

  it("phrases a single rain issue naturally", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 70,
      windSpeed: 5,
      rainChance: 32,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: "fair" }],
    };

    expect(getMessage(weather, "maybe")).toBe(
      "Rideable. But it’s rainy (32% chance).",
    );
  });

  it("names heavy rain codes when rain percentage alone looks low", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 65,
      hourly: [{ hour: 10, condition: "poor" }],
    };

    expect(getMessage(weather, "no")).toContain("heavy rain");
  });

  it("names snow codes when raw metrics do not explain the downgrade", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 73,
      hourly: [{ hour: 10, condition: "marginal" }],
    };

    expect(getMessage(weather, "maybe")).toContain("snow");
  });

  it("names fog codes when raw metrics do not explain the downgrade", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 45,
      hourly: [{ hour: 10, condition: "fair" }],
    };

    expect(getMessage(weather, "maybe")).toContain("fog");
  });

  it("describes gusts when they are the worse wind factor", () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 72,
      windSpeed: 8, // good sustained
      windGust: 34, // poor gusts
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: "poor" }],
    };

    expect(getMessage(weather, "no")).toContain("strong gusts (34 mph gusts)");
  });
});

describe("Rain Timing Logic", () => {
  it('returns "Clearing up by..." when rain is happening now but stops later', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe("Clears by 11am");
  });

  it("handles midnight wraparound in rain timing", () => {
    const hourly = [
      { hour: 23, rainChance: 50 },
      { hour: 0, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe("Clears by 12am");
  });

  it("handles rain spanning midnight", () => {
    const hourly = [
      { hour: 23, rainChance: 10 },
      { hour: 0, rainChance: 50 },
      { hour: 1, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe("Rain 12am–1am");
  });

  it('returns "Rain likely after..." when rain starts later', () => {
    const hourly = [
      { hour: 10, rainChance: 0 },
      { hour: 11, rainChance: 50 },
    ];
    expect(getRainTiming(hourly)).toBe("Rain likely after 11am");
  });

  it('returns "Rain throughout" when it rains the entire window', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 60 },
    ];
    expect(getRainTiming(hourly)).toBe("Rain throughout");
  });

  it("uses the first contiguous shower block instead of merging separated rain periods", () => {
    const hourly = [
      { hour: 10, rainChance: 10 },
      { hour: 11, rainChance: 50 },
      { hour: 12, rainChance: 0 },
      { hour: 13, rainChance: 60 },
      { hour: 14, rainChance: 0 },
    ];

    expect(getRainTiming(hourly)).toBe("Rain 11am–12pm");
  });

  it("does not call rain throughout when the current shower ends before a later second round", () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 0 },
      { hour: 12, rainChance: 60 },
    ];

    expect(getRainTiming(hourly)).toBe("Clears by 11am");
  });
});

describe("Daily Forecast Logic", () => {
  it("marks thunderstorm days as bad even if other daily metrics look okay", () => {
    expect(
      getDailyCondition({ feelsHigh: 72, wind: 8, rain: 20, code: 95 }),
    ).toBe("bad");
  });

  it("treats heavy rain codes as poor riding conditions even when rain percentage looks low", () => {
    expect(
      getDailyCondition({ feelsHigh: 72, wind: 8, rain: 10, code: 65 }),
    ).toBe("poor");
  });

  it("downgrades snowy days so they are not presented as ideal ride days", () => {
    expect(
      getDailyCondition({ feelsHigh: 34, wind: 8, rain: 20, code: 73 }),
    ).not.toBe("good");
  });

  it("downgrades a daily verdict when max dewpoint is oppressive", () => {
    expect(
      getDailyCondition({
        feelsHigh: 72,
        wind: 8,
        rain: 10,
        code: 1,
        dewpoint: 75,
      }),
    ).toBe("bad");
  });

  it("does not change daily verdict when dewpoint is omitted", () => {
    expect(
      getDailyCondition({ feelsHigh: 72, wind: 8, rain: 10, code: 1 }),
    ).toBe("good");
  });

  it("rates temperature on the worst feels-like across daylight hours", () => {
    // Mild afternoon high but a genuinely cold daytime low should pull it down.
    expect(
      getDailyCondition({
        feelsLow: 34,
        feelsHigh: 72,
        wind: 8,
        rain: 10,
        code: 1,
      }),
    ).toBe("poor");
  });

  it("downgrades a daily verdict when gusts are strong even if sustained wind is calm", () => {
    expect(
      getDailyCondition({
        feelsHigh: 72,
        wind: 8,
        gust: 34,
        rain: 10,
        code: 1,
      }),
    ).toBe("poor");
  });

  it("treats freezing fog as poor because of road ice", () => {
    expect(
      getDailyCondition({ feelsHigh: 40, wind: 5, rain: 0, code: 48 }),
    ).toBe("poor");
  });
});

describe("Weekly Forecast Logic", () => {
  it("prefers the calmer and drier good day over the hotter one", () => {
    const daily = [
      {
        date: new Date("2026-04-19T12:00:00"),
        condition: "good",
        high: 82,
        low: 63,
        windSpeed: 14,
        rainChance: 20,
      },
      {
        date: new Date("2026-04-20T12:00:00"),
        condition: "good",
        high: 72,
        low: 56,
        windSpeed: 6,
        rainChance: 5,
      },
    ];

    expect(getBestDayInfo(daily).index).toBe(1);
  });

  it("only calls genuinely good days the best ride days when good options exist", () => {
    const daily = [
      { date: new Date("2026-04-19T12:00:00"), condition: "fair" },
      { date: new Date("2026-04-20T12:00:00"), condition: "good" },
      { date: new Date("2026-04-21T12:00:00"), condition: "fair" },
    ];

    expect(getBestDaysBlurb(daily, 1, "")).toContain(
      "Monday is your best ride window.",
    );
  });

  it("keeps the blurb aligned with the single Best Bet badge when several good days exist", () => {
    const daily = [
      {
        date: new Date("2026-04-19T12:00:00"),
        condition: "good",
        high: 82,
        low: 63,
        windSpeed: 14,
        rainChance: 20,
      },
      {
        date: new Date("2026-04-20T12:00:00"),
        condition: "good",
        high: 72,
        low: 56,
        windSpeed: 6,
        rainChance: 5,
      },
      {
        date: new Date("2026-04-21T12:00:00"),
        condition: "good",
        high: 69,
        low: 52,
        windSpeed: 8,
        rainChance: 10,
      },
    ];

    expect(getBestDaysBlurb(daily, 1, "Low wind and dry roads")).toBe(
      "Monday is the best bet. Low wind and dry roads expected. Today and Tuesday are solid ride windows too.",
    );
  });

  it("summarizes instead of naming every day when most of the week is good", () => {
    const daily = Array.from({ length: 8 }, (_, i) => ({
      date: new Date(`2026-04-${19 + i}T12:00:00`),
      condition: "good",
      high: 72,
      low: 56,
      windSpeed: 6,
      rainChance: 5,
    }));

    expect(getBestDaysBlurb(daily, 1, "Low wind and dry roads")).toBe(
      "Monday is the best bet. Low wind and dry roads expected. Most of the week is rideable too.",
    );
  });

  it("explains when a day looks nice but rates badly because of wind", () => {
    expect(
      getDayConditionReason({
        condition: "bad",
        weatherCode: 1,
        high: 72,
        low: 58,
        windSpeed: 22,
        rainChance: 5,
      }),
    ).toBe("Very windy (22 mph)");
  });

  it("explains bad daily ratings caused by apparent heat", () => {
    expect(
      getDayConditionReason({
        condition: "bad",
        weatherCode: 1,
        high: 89,
        low: 72,
        feelsLike: 98,
        windSpeed: 5,
        rainChance: 5,
        dewpoint: 62,
      }),
    ).toBe("Dangerous heat (feels like 98°)");
  });

  it("explains bad daily ratings caused by oppressive humidity", () => {
    expect(
      getDayConditionReason({
        condition: "bad",
        weatherCode: 1,
        high: 82,
        low: 72,
        feelsLike: 84,
        windSpeed: 5,
        rainChance: 5,
        dewpoint: 75,
      }),
    ).toBe("Oppressive humidity (dew 75°)");
  });

  it("surfaces a positive daily reason for strong ride days", () => {
    expect(
      getDayConditionReason({
        condition: "good",
        weatherCode: 1,
        high: 72,
        low: 56,
        windSpeed: 6,
        rainChance: 5,
      }),
    ).toBe("Low wind and dry");
  });
});

describe("Gear Suggestions", () => {
  const base = {
    feelsLike: 72,
    windSpeed: 5,
    rainChance: 0,
    dewpoint: 50,
    hourly: [],
  };

  const isPerfectHeadline = (text) =>
    /long way|extra loop|extra miles|ideal|prime|beautiful riding|favor extra|clean roads|worth making count/i.test(
      text,
    );

  const matchesItem = (gear, pattern) =>
    gear.items.some(
      (item) => pattern.test(item.label) || pattern.test(item.qualifier ?? ""),
    );

  it("shows PERFECT when all conditions are genuinely good", () => {
    const gear = getGearSuggestion(base, "casual");
    expect(isPerfectHeadline(gear.headline)).toBe(true);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it("shows baseline performance kit when all conditions are genuinely good", () => {
    const gear = getGearSuggestion(base, "pro");
    expect(isPerfectHeadline(gear.headline)).toBe(true);
    expect(matchesItem(gear, /short-sleeve jersey/i)).toBe(true);
    expect(matchesItem(gear, /bib shorts/i)).toBe(true);
  });

  it("does not show PERFECT when rain is high, even on a warm day", () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 70,
        hourly: [
          { feelsLike: 72, windSpeed: 5, rainChance: 70, dewpoint: 50, uv: 0 },
        ],
      },
      "casual",
    );
    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /rain/i)).toBe(true);
  });

  it("does not show PERFECT when wind is high, even on a warm day", () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [
          { feelsLike: 72, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 0 },
        ],
      },
      "casual",
    );
    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /wind/i)).toBe(true);
  });

  it("still shows PERFECT on an ideal day when only benign UV items are added", () => {
    const gear = getGearSuggestion(
      {
        ...base,
        hourly: [
          { feelsLike: 72, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 8 },
        ],
      },
      "casual",
    );

    expect(isPerfectHeadline(gear.headline)).toBe(true);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
    expect(matchesItem(gear, /sunglasses/i)).toBe(true);
  });

  it("falls back to a quiet NEUTRAL base on an ideal day with a real caveat", () => {
    const gear = getGearSuggestion(
      {
        ...base,
        dewpoint: 70,
        hourly: [
          { feelsLike: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 },
        ],
      },
      "casual",
    );

    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /muggy/i)).toBe(true);
  });

  it("picks one consistent bottom across a cold-start, hot-peak window", () => {
    const gear = getGearSuggestion(
      {
        feelsLike: 52,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: 50,
        hourly: [
          { feelsLike: 52, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 3 },
          { feelsLike: 66, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 5 },
          { feelsLike: 78, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 6 },
          { feelsLike: 84, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 7 },
        ],
      },
      "casual",
    );

    const bottoms = gear.items.filter((item) => item.slot === "bottom");
    expect(bottoms).toHaveLength(1);
    // The hot peak wins the bottom slot, matching the top-slot behavior.
    expect(bottoms[0].label).toMatch(/^shorts$/i);
  });

  it("keeps casual baseline bottoms when muggy neutral weather replaces the top", () => {
    const gear = getGearSuggestion(
      {
        ...base,
        dewpoint: 70,
        hourly: [
          { feelsLike: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 },
        ],
      },
      "casual",
    );

    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /moisture-wicking short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it("keeps performance baseline clothing when neutral weather adds support items", () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [
          { feelsLike: 72, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 8 },
        ],
      },
      "pro",
    );

    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve jersey/i)).toBe(true);
    expect(matchesItem(gear, /bib shorts/i)).toBe(true);
    expect(matchesItem(gear, /wind vest/i)).toBe(true);
    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
  });
});

describe("Weather Alerts", () => {
  it("keeps the derived heat alert when the NWS alert is unrelated excessive weather", () => {
    const alerts = getWeatherAlerts({
      feelsLike: 105,
      nwsAlerts: [{ type: "nws", event: "Excessive Rainfall Warning" }],
    });

    expect(alerts.some((alert) => alert.type === "heat")).toBe(true);
  });

  it("does not duplicate a heat alert when NWS already issued one", () => {
    const alerts = getWeatherAlerts({
      feelsLike: 105,
      nwsAlerts: [{ type: "nws", event: "Heat Advisory" }],
    });

    expect(alerts.filter((alert) => alert.type === "heat")).toHaveLength(0);
  });
});

describe("Ride Factors", () => {
  it("returns empty array when status is yes", () => {
    const weather = {
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 1,
    };
    expect(getRideFactors(weather, "yes")).toEqual([]);
  });

  it("returns empty array when weather is null", () => {
    expect(getRideFactors(null, "no")).toEqual([]);
  });

  it("ranks worst conditions first and limits to 3 factors", () => {
    const weather = {
      feelsLike: 30, // bad
      windSpeed: 22, // bad
      rainChance: 50, // poor
      dewpoint: 75, // bad
      aqi: 20, // good
      weatherCode: 1,
    };
    const factors = getRideFactors(weather, "no");
    expect(factors).toHaveLength(3);
    expect(factors[0].condition).toBe("bad");
    expect(factors[1].condition).toBe("bad");
    expect(factors[2].condition).toBe("bad");
  });

  it("includes a weather code factor when it limits the ride", () => {
    const weather = {
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      weatherCode: 65, // heavy rain -> poor
    };
    const factors = getRideFactors(weather, "no");
    expect(
      factors.some((f) => f.type === "weatherCode" && f.value === "Heavy rain"),
    ).toBe(true);
  });

  it("does not include missing AQI", () => {
    const weather = {
      feelsLike: 48, // fair -> maybe
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: null,
      weatherCode: 1,
    };
    const factors = getRideFactors(weather, "maybe");
    expect(factors.some((f) => f.type === "aqi")).toBe(false);
    expect(factors.some((f) => f.type === "feelsLike")).toBe(true);
  });

  it("surfaces thunderstorm as the overriding bad factor", () => {
    const weather = {
      feelsLike: 72,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      hasThunderstorms: true,
      weatherCode: 95,
    };
    const factors = getRideFactors(weather, "no");
    expect(factors[0].type).toBe("weatherCode");
    expect(factors[0].condition).toBe("bad");
  });

  it("labels the wind factor by gusts when gusts are the limiter", () => {
    const weather = {
      feelsLike: 72,
      windSpeed: 8, // good sustained
      windGust: 34, // poor gusts
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 1,
    };
    const factors = getRideFactors(weather, "no");
    const wind = factors.find((f) => f.type === "windSpeed");
    expect(wind).toBeDefined();
    expect(wind.value).toBe("34 mph gusts");
    expect(wind.condition).toBe("poor");
  });
});

describe("Best Ride Window", () => {
  it("returns 'Best now' when the current hour is good", () => {
    const hourly = [{ hour: 10, condition: "good" }];
    expect(getBestRideWindow(hourly)).toBe("Best now");
  });

  it("returns 'Improves around X' when a later fair-or-better window exists", () => {
    const hourly = [
      { hour: 10, condition: "bad" },
      { hour: 11, condition: "bad" },
      { hour: 12, condition: "fair" },
    ];
    expect(getBestRideWindow(hourly)).toBe("Improves around 12pm");
  });

  it("returns 'No clear window' when conditions never improve", () => {
    const hourly = [
      { hour: 10, condition: "bad" },
      { hour: 11, condition: "poor" },
      { hour: 12, condition: "bad" },
    ];
    expect(getBestRideWindow(hourly)).toBe(
      "No clear window in the next 24 hours",
    );
  });

  it("handles empty hourly", () => {
    expect(getBestRideWindow([])).toBeNull();
  });

  it("prefers good over fair when current is fair", () => {
    const hourly = [
      { hour: 10, condition: "fair" },
      { hour: 11, condition: "fair" },
      { hour: 12, condition: "good" },
    ];
    expect(getBestRideWindow(hourly)).toBe("Improves around 12pm");
  });
});
