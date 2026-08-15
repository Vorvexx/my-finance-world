const UNSIGNED_DECIMAL_MONEY = /^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)\.\d{2}$/;

export class ExactMoneyParseError extends Error {
  constructor() {
    super("EXACT_MONEY_INVALID");
    this.name = "ExactMoneyParseError";
  }
}

export const parseUnsignedDecimalMoneyToCents = (value: string): number => {
  if (!UNSIGNED_DECIMAL_MONEY.test(value)) throw new ExactMoneyParseError();

  const [whole, fraction] = value.replaceAll(",", "").split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new ExactMoneyParseError();
  return Number(cents);
};
