"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classOptions = exports.booksCatalog = void 0;
exports.getLanguagesForClass = getLanguagesForClass;
const books_output_json_1 = __importDefault(require("../data/books-output.json"));
const devanagariDigitMap = {
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
const normalizedLanguageMap = {
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
function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function normalizeDigits(value) {
    return value.replace(/[०-९]/g, (digit) => devanagariDigitMap[digit] ?? digit);
}
function parseClassValue(value) {
    const normalized = normalizeDigits(value);
    const match = normalized.match(/\b(\d{1,2})\b/);
    return match ? `Class ${match[1]}` : "Uncategorized";
}
function parseLanguage(title, medium) {
    const source = normalizeWhitespace(`${title} ${medium ?? ""}`);
    const found = languageKeywords.find((keyword) => source.includes(keyword));
    return found ? (normalizedLanguageMap[found] ?? found) : "General";
}
function buildBookId(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
exports.booksCatalog = books_output_json_1.default.map((book) => {
    const normalizedTitle = normalizeWhitespace(book.title);
    const classLabel = parseClassValue(book.class || normalizedTitle);
    const language = parseLanguage(normalizedTitle, book.Medium);
    const medium = normalizeWhitespace(book.Medium || language);
    const subject = normalizeWhitespace(normalizedTitle
        .replace(/[०-९0-9]+\s*(ली|री|वी|थी)?/g, "")
        .replace(/(मराठी|हिंदी|इंग्रजी|उर्दु|उर्दू|गुजराती|कन्नड|सिंधी|तेलुगु|तामिळ|तमिळ|बंगाली)/g, "")) || normalizedTitle;
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
exports.classOptions = Array.from(new Set(exports.booksCatalog.map((book) => book.class_label))).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
function getLanguagesForClass(classLabel) {
    return Array.from(new Set(exports.booksCatalog
        .filter((book) => !classLabel || book.class_label === classLabel)
        .map((book) => book.language))).sort();
}
//# sourceMappingURL=books.js.map