/** @typedef {import('@/types/weather').Condition} Condition */

/** @type {Record<Condition, string>} */
const CONDITION_BADGE_CLASSES = {
  good: "nb-chip nb-chip-good",
  fair: "nb-chip nb-chip-fair",
  marginal: "nb-chip nb-chip-marginal",
  poor: "nb-chip nb-chip-poor",
  bad: "nb-chip nb-chip-bad",
};

/** @type {Record<Condition, string>} */
const CONDITION_CHART_TOKENS = {
  good: "var(--cond-good)",
  fair: "var(--cond-fair)",
  marginal: "var(--cond-marginal)",
  poor: "var(--cond-poor)",
  bad: "var(--cond-bad)",
};

/** @type {Set<Condition>} */
const ATTENTION_CONDITIONS = new Set(["marginal", "poor", "bad"]);

/** @param {Condition | string | null | undefined} condition */
export function getConditionBadgeVariant(condition) {
  return CONDITION_BADGE_CLASSES[/** @type {Condition} */ (condition)] ?? "nb-chip";
}

/** @param {Condition | string | null | undefined} condition */
export function getConditionChartColor(condition) {
  return CONDITION_CHART_TOKENS[/** @type {Condition} */ (condition)] ?? "var(--color-base-content)";
}

/** @param {Condition | string | null | undefined} condition */
export function isAttentionCondition(condition) {
  return ATTENTION_CONDITIONS.has(/** @type {Condition} */ (condition));
}
