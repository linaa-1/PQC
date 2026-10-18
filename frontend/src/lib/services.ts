import type { ScanJob } from "../types/domain";
import { assets, evidence, findings, scans } from "../mocks/data";

// The interface talks to this promise-based boundary, not directly to an assumed backend.
const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export async function mockRequest<T>(value: T, options: { latency?: number; failRate?: number } = {}): Promise<T> {
  await pause(options.latency ?? 240);
  if (options.failRate && Math.random() < options.failRate) throw new Error("Service on-premise temporairement indisponible");
  return value;
}

export const api = {
  getDashboard: () => mockRequest({ assets, evidence, findings, scans }, { latency: 280 }),
  getAssets: () => mockRequest(assets),
  getEvidence: () => mockRequest(evidence),
  getScans: () => mockRequest(scans),
  createScan: (job: ScanJob) => mockRequest(job, { latency: 650 }),
  evaluatePolicy: () => mockRequest({ updated: 3 }, { latency: 950 }),
  exportCbom: () => mockRequest({ status: "VALIDATED", format: "CycloneDX 1.6" }, { latency: 700 }),
};