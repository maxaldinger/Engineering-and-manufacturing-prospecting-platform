// Deep-scan: opt-in, per-account enrichment that would run up to 7 targeted
// queries per company across N selected accounts. STUBBED interface only at this
// step. The live fan-out (extra API calls, provider wiring) is intentionally not
// implemented, so nothing here spends quota or invents data.

export interface DeepScanRequest {
  companyKey: string;
  maxQueries: number; // capped at 7 per account
}

export interface DeepScanResult {
  status: "stub";
  queriesPlanned: number;
  note: string;
}

export interface DeepScanProvider {
  scan(req: DeepScanRequest): Promise<DeepScanResult>;
}

export const DEEP_SCAN_MAX_QUERIES = 7;

// The default provider: a no-op stub. Swap behind this interface (like the
// geocoder) when the live deep-scan is built.
export const stubDeepScan: DeepScanProvider = {
  async scan(req: DeepScanRequest): Promise<DeepScanResult> {
    const queriesPlanned = Math.max(0, Math.min(DEEP_SCAN_MAX_QUERIES, req.maxQueries));
    return {
      status: "stub",
      queriesPlanned,
      note: `deep-scan not implemented; would run up to ${queriesPlanned} queries for ${req.companyKey}`,
    };
  },
};
