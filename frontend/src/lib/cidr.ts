const ipv4ToBigInt = (address: string) => {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((accumulator, part) => (accumulator << 8n) + BigInt(Number(part)), 0n);
};

export function parseCidr(value: string) {
  const [address, prefixText, extra] = value.trim().split("/");
  const ip = ipv4ToBigInt(address ?? "");
  if (ip === null || extra !== undefined) return null;
  const prefix = prefixText === undefined ? 32 : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const hostBits = 32n - BigInt(prefix);
  const size = 1n << hostBits;
  const network = (ip / size) * size;
  return { address, prefix, start: network, end: network + size - 1n, size };
}

export function isValidCidr(value: string) { return parseCidr(value) !== null; }

export function cidrsOverlap(left: string, right: string) {
  const a = parseCidr(left); const b = parseCidr(right);
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

export function cidrContains(parent: string, child: string) {
  const a = parseCidr(parent); const b = parseCidr(child);
  if (!a || !b) return false;
  return a.start <= b.start && a.end >= b.end;
}

export function cidrAddressCount(value: string) {
  const range = parseCidr(value);
  if (!range) return 0;
  if (range.size > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(range.size);
}

export function portsAreValid(value: string) {
  const parts = value.split(",").map((part) => part.trim());
  if (!parts.length || parts.some((part) => !part)) return false;
  return parts.every((part) => {
    if (!/^\d{1,5}(-\d{1,5})?$/.test(part)) return false;
    const [first, last] = part.split("-").map(Number);
    return first >= 1 && first <= 65535 && (last === undefined || (last >= first && last <= 65535));
  });
}

export function countPorts(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean).reduce((sum, part) => {
    const [first, last] = part.split("-").map(Number);
    return sum + (last ? last - first + 1 : 1);
  }, 0);
}