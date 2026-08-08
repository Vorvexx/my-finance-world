export const normalizeCounterparty = (description: string) =>
  description
    .toUpperCase()
    .replace(/\b(POS|DEBIT|CREDIT|PURCHASE|PAYMENT|ONLINE|PREAUTHORIZED|PAD)\b/g, " ")
    .replace(/[#*]\w+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{3,}\b.*$/, "")
    .trim();
