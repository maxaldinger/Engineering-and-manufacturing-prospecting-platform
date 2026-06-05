// Central brand identity. Vendor-neutral by design: every product-facing
// name, tagline, and outbound User-Agent is derived from here, so rebranding
// (or white-labeling for another reseller) is a single-file change.
export const BRAND = {
  // Product name. Used in titles, the sidebar/header wordmark, and metadata.
  name: "Portfolio Prospecting",
  // Short sub-label shown under the wordmark.
  tagline: "Territory Intelligence",
  // One-line product description for page metadata.
  description:
    "Find prospects in your territory by the products they run, across the full reseller portfolio.",
  // Sent as User-Agent on outbound requests to public data sources. No personal
  // contact details — identifies the tool generically.
  userAgent: "PortfolioProspecting/1.0 (+territory prospecting tool)",
  // The reseller this deployment is configured for. White-labelable: every
  // "Why <reseller>", "<reseller> solution/advantage", and local-support line in
  // the brief routes through here, never a hardcoded string. The product line
  // (SOLIDWORKS) stays catalog-fixed and is NOT genericized by this.
  reseller: {
    name: "Our Team",
    short: "our team",
    supportLine:
      "US-based engineering support, training, and implementation",
  },
} as const;
