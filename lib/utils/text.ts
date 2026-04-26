export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

/** Truncate to ~maxTokens (chars/4 heuristic), cleanly at paragraph boundary. */
export function truncateAtParagraph(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  const lastPara = sliced.lastIndexOf("\n\n");
  return lastPara > maxChars * 0.5 ? sliced.slice(0, lastPara) : sliced;
}

/** Flesch reading ease, mapped to 0..1 with peak around 60–70. */
export function fleschReadingEase(text: string): number {
  const sentences = (text.match(/[.!?]+/g) ?? []).length || 1;
  const words = wordCount(text) || 1;
  const syllables = countSyllables(text) || 1;
  const flesch =
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  // Map: 0 → 0, 65 → 1, 100 → 0.7 (over-easy), <0 → 0
  if (flesch <= 0) return 0;
  if (flesch >= 100) return 0.7;
  if (flesch <= 65) return flesch / 65;
  return 1 - ((flesch - 65) / 35) * 0.3;
}

function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let total = 0;
  for (const w of words) {
    const groups = w.match(/[aeiouy]+/g) ?? [];
    let n = groups.length;
    if (w.endsWith("e") && n > 1) n -= 1;
    total += Math.max(1, n);
  }
  return total;
}

export function trigrams(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) {
    out.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return out;
}
