import rawBooks from "../data/books-output.json";

type RawBook = {
  class?: string;
  title: string;
  Medium?: string;
  src: string;
};

const devanagariDigitMap: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const languageKeywords = [
  "मराठी",
  "हिंदी",
  "इंग्रजी",
  "उर्दु",
  "उर्दू",
  "ગુજરાતી",
  "गुजराती",
  "कन्नड",
  "सिंधी",
  "तेलुगु",
  "तामिळ",
  "तमिळ",
  "बंगाली",
];

const normalizedLanguageMap: Record<string, string> = {
  "मराठी": "Marathi",
  "हिंदी": "Hindi",
  "इंग्रजी": "English",
  "उर्दु": "Urdu",
  "उर्दू": "Urdu",
  "ગુજરાતી": "Gujarati",
  "गुजराती": "Gujarati",
  "कन्नड": "Kannada",
  "सिंधी": "Sindhi",
  "तेलुगु": "Telugu",
  "तामिळ": "Tamil",
  "तमिळ": "Tamil",
  "बंगाली": "Bengali",
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDigits(value: string): string {
  return value.replace(/[०-९]/g, (digit) => devanagariDigitMap[digit] ?? digit);
}

function parseClassValue(value: string): string {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/\b(\d{1,2})\b/);
  return match ? `Class ${match[1]}` : "Uncategorized";
}

function parseLanguage(title: string, medium?: string): string {
  const source = normalizeWhitespace(`${title} ${medium ?? ""}`);
  const found = languageKeywords.find((keyword) => source.includes(keyword));
  return found ? (normalizedLanguageMap[found] ?? found) : "General";
}

function buildBookId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type BookRecord = {
  id: string;
  title: string;
  subject: string;
  class_label: string;
  language: string;
  medium: string;
  pdf_url: string;
};

export const booksCatalog: BookRecord[] = (rawBooks as RawBook[]).map((book) => {
  const normalizedTitle = normalizeWhitespace(book.title);
  const classLabel = parseClassValue(book.class || normalizedTitle);
  const language = parseLanguage(normalizedTitle, book.Medium);
  const medium = normalizeWhitespace(book.Medium || language);
  const subject = normalizeWhitespace(
    normalizedTitle
      .replace(/[०-९0-9]+\s*(ली|री|वी|थी)?/g, "")
      .replace(
        /(मराठी|हिंदी|इंग्रजी|उर्दु|उर्दू|गुजराती|कन्नड|सिंधी|तेलुगु|तामिळ|तमिळ|बंगाली)/g,
        "",
      ),
  ) || normalizedTitle;

  return {
    id: buildBookId(`${classLabel}-${language}-${normalizedTitle}-${book.src}`),
    title: normalizedTitle,
    subject,
    class_label: classLabel,
    language,
    medium,
    pdf_url: book.src,
  };
});

export const classOptions = Array.from(
  new Set(booksCatalog.map((book) => book.class_label)),
).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

export function getLanguagesForClass(classLabel?: string): string[] {
  return Array.from(
    new Set(
      booksCatalog
        .filter((book) => !classLabel || book.class_label === classLabel)
        .map((book) => book.language),
    ),
  ).sort();
}
