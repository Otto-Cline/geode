import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { extractReadableContent } from "./extractReadableContent";
import type { ExtractedPage } from "@/lib/models/audit";

const FETCH_TIMEOUT_MS = 15_000;
const UA = "GeoAuditBot/0.1 (+https://example.com)";

export async function fetchPage(url: string): Promise<ExtractedPage> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html"))
      throw new Error(`fetch ${url} → non-HTML (${ct})`);
    html = await res.text();
  } finally {
    clearTimeout(t);
  }

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const reader = new Readability(doc.cloneNode(true) as Document);
  const article = reader.parse();
  const readableHtml = article?.content ?? doc.body.innerHTML;
  const title = article?.title ?? doc.title ?? url;
  const metaDescription = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute("content") ?? undefined;

  // Count outbound links from the ORIGINAL document (Readability strips many).
  const targetHost = new URL(url).hostname;
  let outbound = 0,
    sameDomain = 0;
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === targetHost) sameDomain++;
      else outbound++;
    } catch {
      /* ignore malformed */
    }
  });

  const readableDom = new JSDOM(readableHtml);
  const extracted = extractReadableContent(readableDom.window.document);

  return {
    url,
    title,
    metaDescription,
    headings: extracted.headings,
    paragraphs: extracted.paragraphs,
    lists: extracted.lists,
    tables: extracted.tables,
    outboundLinkCount: outbound,
    sameDomainLinkCount: sameDomain,
    fullText: extracted.fullText,
  };
}
