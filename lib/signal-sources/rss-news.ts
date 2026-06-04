// Real news signals from free public RSS feeds. No API keys.
// Each item is filtered to the rep's region by checking the title and
// description for state name, common cities, or the state code.

import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";
import { relativeAge, scoreSignal, summarize } from "./extract";
import { BRAND } from "@/lib/brand";
import { classifyText } from "@/lib/catalog";
import { routeMatches } from "@/lib/discovery";

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: Date | null;
  source: string;
}

interface FeedSpec {
  url: string;
  source: string;
  signalType: Signal["signalType"];
}

// Free RSS feeds aimed at the manufacturing audience. All publish under
// their public RSS URLs and require no auth. We rotate through several
// so the feed has varied sources.
const FEEDS: FeedSpec[] = [
  {
    url: "https://www.mmsonline.com/rss/articles",
    source: "Modern Machine Shop",
    signalType: "Tech Adoption",
  },
  {
    url: "https://www.mmsonline.com/rss/news",
    source: "Modern Machine Shop",
    signalType: "News",
  },
  {
    url: "https://www.industryweek.com/rss",
    source: "IndustryWeek",
    signalType: "News",
  },
  {
    url: "https://www.americanmachinist.com/rss.xml",
    source: "American Machinist",
    signalType: "News",
  },
  {
    url: "https://www.aerospacemanufacturinganddesign.com/rss/",
    source: "Aerospace Manufacturing and Design",
    signalType: "Tech Adoption",
  },
];

// City and region indicators used to coarsely filter to a state. We
// include the state name and a handful of common cities per state. This
// is intentionally loose; better to surface a possibly-relevant article
// than to silently drop it.
const STATE_HINTS: Record<string, string[]> = {
  AL: ["alabama", "huntsville", "birmingham", "mobile", "tuscaloosa"],
  AK: ["alaska", "anchorage", "fairbanks"],
  AZ: ["arizona", "phoenix", "tucson", "mesa", "chandler"],
  AR: ["arkansas", "little rock", "fayetteville"],
  CA: ["california", "los angeles", "san diego", "san francisco", "san jose", "sacramento", "fremont", "long beach", "hawthorne"],
  CO: ["colorado", "denver", "boulder", "colorado springs"],
  CT: ["connecticut", "hartford", "groton", "stratford"],
  DE: ["delaware", "wilmington"],
  FL: ["florida", "miami", "tampa", "orlando", "jacksonville", "cape canaveral"],
  GA: ["georgia", "atlanta", "marietta", "savannah"],
  HI: ["hawaii", "honolulu"],
  ID: ["idaho", "boise"],
  IL: ["illinois", "chicago", "peoria", "rockford", "moline"],
  IN: ["indiana", "indianapolis", "fort wayne", "elkhart"],
  IA: ["iowa", "des moines", "cedar rapids", "davenport"],
  KS: ["kansas", "wichita", "olathe", "topeka"],
  KY: ["kentucky", "louisville", "lexington"],
  LA: ["louisiana", "new orleans", "baton rouge"],
  ME: ["maine", "portland", "bath"],
  MD: ["maryland", "baltimore", "annapolis"],
  MA: ["massachusetts", "boston", "cambridge", "worcester"],
  MI: ["michigan", "detroit", "grand rapids", "ann arbor", "warren"],
  MN: ["minnesota", "minneapolis", "saint paul", "rochester mn"],
  MS: ["mississippi", "jackson", "pascagoula"],
  MO: ["missouri", "st. louis", "saint louis", "kansas city"],
  MT: ["montana", "billings", "bozeman"],
  NE: ["nebraska", "omaha", "lincoln"],
  NV: ["nevada", "reno", "las vegas", "sparks"],
  NH: ["new hampshire", "manchester", "nashua"],
  NJ: ["new jersey", "newark", "trenton"],
  NM: ["new mexico", "albuquerque"],
  NY: ["new york", "rochester ny", "syracuse", "buffalo", "albany"],
  NC: ["north carolina", "charlotte", "raleigh", "greensboro"],
  ND: ["north dakota", "fargo", "bismarck"],
  OH: ["ohio", "cleveland", "cincinnati", "columbus oh", "dayton", "akron", "toledo"],
  OK: ["oklahoma", "tulsa", "oklahoma city"],
  OR: ["oregon", "portland or", "hillsboro", "eugene"],
  PA: ["pennsylvania", "philadelphia", "pittsburgh", "erie", "allentown"],
  RI: ["rhode island", "providence"],
  SC: ["south carolina", "greenville", "charleston", "spartanburg"],
  SD: ["south dakota", "sioux falls", "rapid city"],
  TN: ["tennessee", "nashville", "memphis", "knoxville", "chattanooga"],
  TX: ["texas", "houston", "dallas", "austin", "san antonio", "fort worth"],
  UT: ["utah", "salt lake city", "ogden"],
  VT: ["vermont", "burlington"],
  VA: ["virginia", "norfolk", "richmond", "newport news"],
  WA: ["washington state", "seattle", "bellevue", "redmond", "kent", "auburn", "tacoma", "everett", "spokane", "bremerton"],
  WV: ["west virginia", "charleston wv"],
  WI: ["wisconsin", "milwaukee", "madison"],
  WY: ["wyoming", "cheyenne", "casper"],
  DC: ["washington dc", "district of columbia"],
  AB: ["alberta", "calgary", "edmonton"],
  BC: ["british columbia", "vancouver bc", "burnaby", "victoria bc"],
  MB: ["manitoba", "winnipeg"],
  NB: ["new brunswick", "moncton", "fredericton"],
  NL: ["newfoundland", "labrador", "st. john's"],
  NS: ["nova scotia", "halifax"],
  NT: ["northwest territories", "yellowknife"],
  NU: ["nunavut", "iqaluit"],
  ON: ["ontario", "toronto", "ottawa", "hamilton on", "windsor on", "mississauga"],
  PE: ["prince edward island", "charlottetown"],
  QC: ["quebec", "montreal", "laval"],
  SK: ["saskatchewan", "saskatoon", "regina"],
  YT: ["yukon", "whitehorse"],
};

// Extracts text content between a tag pair. CDATA is stripped.
function tagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  let raw = m[1];
  // Strip CDATA wrapper if present
  raw = raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
  // Strip HTML tags
  raw = raw.replace(/<[^>]+>/g, "");
  // Decode common entities
  raw = raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  return raw.trim();
}

function parseRss(xml: string, spec: FeedSpec): RssItem[] {
  const items: RssItem[] = [];
  // Match <item>...</item> for RSS 2.0 or <entry>...</entry> for Atom
  const itemBlocks = [
    ...xml.matchAll(/<item[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi),
  ];
  for (const m of itemBlocks) {
    const block = m[0];
    const title = tagContent(block, "title");
    const description =
      tagContent(block, "description") ||
      tagContent(block, "summary") ||
      tagContent(block, "content:encoded") ||
      tagContent(block, "content");
    const linkRaw = tagContent(block, "link");
    let link = linkRaw;
    if (!link) {
      const atomLink = block.match(/<link[^>]*href="([^"]+)"/i);
      if (atomLink) link = atomLink[1];
    }
    const pubDateRaw =
      tagContent(block, "pubDate") ||
      tagContent(block, "published") ||
      tagContent(block, "updated") ||
      tagContent(block, "dc:date");
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
    if (!title) continue;
    items.push({
      title,
      description,
      link: link || "",
      pubDate: pubDate && !isNaN(pubDate.getTime()) ? pubDate : null,
      source: spec.source,
    });
  }
  return items;
}

async function fetchFeed(spec: FeedSpec): Promise<RssItem[]> {
  try {
    const res = await fetch(spec.url, {
      headers: {
        "User-Agent": BRAND.userAgent,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
      next: { revalidate: 1800 }, // 30 minutes
    });
    if (!res.ok) {
      console.warn(
        `rss-news: feed "${spec.source}" (${spec.url}) returned ${res.status}; skipping this feed (its news will be missing from the feed).`
      );
      return [];
    }
    const xml = await res.text();
    return parseRss(xml, spec);
  } catch (err) {
    console.warn(
      `rss-news: feed "${spec.source}" (${spec.url}) fetch failed (${
        err instanceof Error ? err.message : String(err)
      }); skipping this feed.`
    );
    return [];
  }
}

function regionMatches(text: string, code: string): boolean {
  const hints = STATE_HINTS[code];
  if (!hints) return false;
  const lower = text.toLowerCase();
  if (hints.some((h) => lower.includes(h))) return true;
  // Code as a stand-alone token, e.g. "TX" or " WA "
  const codeRe = new RegExp(`(^|[^a-z])${code}([^a-z]|$)`, "i");
  return codeRe.test(text);
}

function rssItemToSignal(
  item: RssItem,
  spec: FeedSpec,
  stateCode: string
): Signal | null {
  const haystack = `${item.title} ${item.description}`;
  const { detectedSoftware, productTypes } = classifyText(haystack);
  const daysOld = item.pubDate
    ? Math.floor((Date.now() - item.pubDate.getTime()) / 86_400_000)
    : undefined;

  // News from a generic feed is keyed to the source URL so dedupe
  // collapses items reposted across feeds.
  const id = `rss-${spec.source.replace(/\s+/g, "-").toLowerCase()}-${item.link.slice(-32)}`;

  return {
    id,
    company: item.title.split(/[:\-|]/)[0]?.trim().slice(0, 80) || item.title.slice(0, 80),
    industry: "Manufacturing news",
    city: stateCode,
    state: stateCode,
    distanceMiles: 0,
    employeeEstimate: undefined,
    revenueEstimate: undefined,
    detectedSoftware,
    // [] = Unclassified (no product type matched in the headline/summary).
    productTypes,
    signalType: spec.signalType,
    title: item.title,
    description: summarize(item.description || item.title),
    sourceLabel: item.source,
    sourceUrl: item.link,
    postedAgo: relativeAge(item.pubDate),
    signalStrength: scoreSignal({
      hasCam: detectedSoftware.length > 0,
      hasCadOnly: detectedSoftware.some((d) => /solidworks|catia|inventor/i.test(d.name)) && !detectedSoftware.some((d) => /mastercam|fusion|hsmworks|gibbscam|esprit|bobcad|nx cam|edgecam|surfcam|featurecam/i.test(d.name)),
      productTypes,
      daysOld,
    }),
    contacts: [],
  };
}

// Route-scoped: an article must match BOTH the region AND the selected product's
// route terms. Trade press skews CAM/manufacturing, so this is rich for CAM and
// thin for other routes (Adzuna carries those) — but it never surfaces an
// article irrelevant to the chosen product.
export async function fetchNewsSignalsForRegion(
  stateCode: string,
  product: ProductTypeId
): Promise<Signal[]> {
  if (!stateCode) return [];
  const all = await Promise.all(FEEDS.map(fetchFeed));
  const results: Signal[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < FEEDS.length; i++) {
    const items = all[i];
    const spec = FEEDS[i];
    for (const item of items) {
      const text = `${item.title} ${item.description}`;
      if (!regionMatches(text, stateCode)) continue;
      if (!routeMatches(text, product)) continue;
      const sig = rssItemToSignal(item, spec, stateCode);
      if (!sig) continue;
      if (seenIds.has(sig.id)) continue;
      seenIds.add(sig.id);
      results.push(sig);
    }
  }

  // Cap to a reasonable number so the feed doesn't drown in news
  return results.slice(0, 25);
}
