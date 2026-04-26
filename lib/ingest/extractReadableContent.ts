type Extracted = {
  headings: { level: number; text: string }[];
  paragraphs: string[];
  lists: string[][];
  tables: string[][];
  fullText: string;
};

export function extractReadableContent(doc: Document): Extracted {
  const headings: Extracted["headings"] = [];
  doc.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    headings.push({
      level: Number(h.tagName.slice(1)),
      text: (h.textContent ?? "").trim(),
    });
  });

  const paragraphs = Array.from(doc.querySelectorAll("p"))
    .map((p) => (p.textContent ?? "").trim())
    .filter((t) => t.length > 0);

  const lists: string[][] = [];
  doc.querySelectorAll("ul,ol").forEach((list) => {
    const items = Array.from(list.querySelectorAll(":scope > li"))
      .map((li) => (li.textContent ?? "").trim())
      .filter((t) => t.length > 0);
    if (items.length > 0) lists.push(items);
  });

  const tables: string[][] = [];
  doc.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr"))
      .map((tr) =>
        Array.from(tr.querySelectorAll("th,td"))
          .map((c) => (c.textContent ?? "").trim())
          .join(" | "),
      )
      .filter((r) => r.length > 0);
    if (rows.length > 0) tables.push(rows);
  });

  const fullText = paragraphs.join("\n\n");
  return { headings, paragraphs, lists, tables, fullText };
}
