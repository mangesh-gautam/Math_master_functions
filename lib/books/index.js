"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.booksApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const books_1 = require("../utils/books");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.get("/classes", (_req, res) => {
    res.status(200).json({
        success: true,
        data: books_1.classOptions.map((classLabel) => ({
            id: classLabel,
            label: classLabel,
            languages_count: (0, books_1.getLanguagesForClass)(classLabel).length,
            books_count: books_1.booksCatalog.filter((book) => book.class_label === classLabel).length,
        })),
    });
});
app.get("/languages", (req, res) => {
    const classLabel = typeof req.query.class === "string" ? req.query.class : undefined;
    res.status(200).json({
        success: true,
        data: (0, books_1.getLanguagesForClass)(classLabel),
    });
});
app.get("/list", (req, res) => {
    const classLabel = typeof req.query.class === "string" ? req.query.class : undefined;
    const language = typeof req.query.language === "string" ? req.query.language : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";
    const data = books_1.booksCatalog.filter((book) => {
        if (classLabel && book.class_label !== classLabel) {
            return false;
        }
        if (language && book.language !== language) {
            return false;
        }
        if (search &&
            !`${book.title} ${book.subject} ${book.language}`.toLowerCase().includes(search)) {
            return false;
        }
        return true;
    });
    res.status(200).json({
        success: true,
        data,
    });
});
app.get("/search", (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const data = books_1.booksCatalog.filter((book) => `${book.title} ${book.subject} ${book.language}`.toLowerCase().includes(query));
    res.status(200).json({ success: true, data });
});
exports.booksApp = app;
//# sourceMappingURL=index.js.map