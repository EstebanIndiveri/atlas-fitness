/**
 * Exact decimal-string arithmetic for progression domain assertions.
 *
 * Domain amounts (`weightKg`) must never be converted to floating point:
 * `parseFloat`/`Number` lose information (the classic `0.1 + 0.2` and
 * `1.1 > 1.01` traps) and are forbidden for domain decisions. Every helper here
 * operates on the decimal string itself.
 *
 * Accepted grammar unless documented otherwise: `^-?\d+(?:\.\d+)?$` — an
 * optional sign, at least one integer digit and an optional fractional part
 * with at least one digit. Forms such as `"1."`, `".5"`, `"1e3"` or `"1,5"` are
 * malformed and raise `MalformedDecimalError` instead of being coerced.
 */

/** Thrown when a value does not match the accepted decimal grammar. */
export class MalformedDecimalError extends Error {
  constructor(value: string) {
    super(`Malformed decimal string: ${JSON.stringify(value)}`);
    this.name = 'MalformedDecimalError';
  }
}

/** Canonical positive form: `0` or `[1-9]\d*`, optional non-zero-terminated fraction. */
const CANONICAL_POSITIVE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/;

/** A value that equals zero in any well-formed representation. */
const ZERO_PATTERN = /^0+(?:\.0+)?$/;

/** Accepted decimal grammar for normalization and comparison. */
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

interface ParsedDecimal {
  negative: boolean;
  /** Integer digits with redundant leading zeros removed; always at least `"0"`. */
  integer: string;
  /** Fraction digits with trailing zeros removed; empty when there is none. */
  fraction: string;
}

function trimLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '');
}

function trimTrailingZeros(digits: string): string {
  return digits.replace(/0+$/, '');
}

function parseExactDecimal(value: string): ParsedDecimal | null {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    return null;
  }

  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const dotIndex = unsigned.indexOf('.');
  const integerPart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const fractionPart = dotIndex === -1 ? '' : unsigned.slice(dotIndex + 1);

  return {
    negative,
    integer: trimLeadingZeros(integerPart),
    fraction: trimTrailingZeros(fractionPart),
  };
}

function isZeroMagnitude(parsed: ParsedDecimal): boolean {
  return parsed.integer === '0' && parsed.fraction === '';
}

/**
 * Returns whether `value` is the canonical string of a positive decimal:
 * no redundant leading integer zeros, no trailing fractional zeros and a
 * strictly positive numeric value.
 */
export function isCanonicalPositiveDecimal(value: string): boolean {
  return (
    typeof value === 'string' &&
    CANONICAL_POSITIVE_PATTERN.test(value) &&
    value !== '0'
  );
}

/**
 * Returns whether `value` equals zero. Non-canonical zero spellings such as
 * `"0"`, `"0.0"`, `"0.00"` and `"000.000"` all count. Malformed input is `false`.
 */
export function isZeroDecimal(value: string): boolean {
  return typeof value === 'string' && ZERO_PATTERN.test(value);
}

/**
 * Rewrites a well-formed decimal into canonical form: strips leading integer
 * zeros and trailing fractional zeros (`"080.50" -> "80.5"`, `"0.00" -> "0"`).
 *
 * @throws {MalformedDecimalError} when `value` does not match the grammar.
 */
export function normalizeExactDecimal(value: string): string {
  const parsed = parseExactDecimal(value);
  if (!parsed) {
    throw new MalformedDecimalError(value);
  }
  if (isZeroMagnitude(parsed)) {
    return '0';
  }
  const magnitude =
    parsed.fraction === '' ? parsed.integer : `${parsed.integer}.${parsed.fraction}`;
  return parsed.negative ? `-${magnitude}` : magnitude;
}

function compareMagnitude(a: ParsedDecimal, b: ParsedDecimal): -1 | 0 | 1 {
  if (a.integer.length !== b.integer.length) {
    return a.integer.length < b.integer.length ? -1 : 1;
  }
  if (a.integer !== b.integer) {
    return a.integer < b.integer ? -1 : 1;
  }
  if (a.fraction !== b.fraction) {
    return a.fraction < b.fraction ? -1 : 1;
  }
  return 0;
}

/**
 * Compares two decimal strings by exact numeric value (sign-aware, full
 * precision). Integer parts are compared by digit length then lexicographically;
 * fractions are compared lexicographically, which is exact for normalized
 * non-negative fractions including shorter prefixes (`"1.1" > "1.01"`).
 *
 * @throws {MalformedDecimalError} when either value does not match the grammar.
 */
export function compareExactDecimal(a: string, b: string): -1 | 0 | 1 {
  const left = parseExactDecimal(a);
  const right = parseExactDecimal(b);
  if (!left || !right) {
    throw new MalformedDecimalError(!left ? a : b);
  }

  const leftSign = isZeroMagnitude(left) ? 0 : left.negative ? -1 : 1;
  const rightSign = isZeroMagnitude(right) ? 0 : right.negative ? -1 : 1;

  if (leftSign !== rightSign) {
    return leftSign < rightSign ? -1 : 1;
  }
  if (leftSign === 0) {
    return 0;
  }

  const magnitude = compareMagnitude(left, right);
  if (magnitude === 0) {
    return 0;
  }
  return leftSign < 0 ? (-magnitude as -1 | 1) : magnitude;
}
