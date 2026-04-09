import express from "express";
import cors from "cors";
import { booksCatalog, classOptions, getLanguagesForClass } from "../utils/books";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/classes", (_req, res) => {
  res.status(200).json({
    success: true,
    data: classOptions.map((classLabel) => ({
      id: classLabel,
      label: classLabel,
      languages_count: getLanguagesForClass(classLabel).length,
      books_count: booksCatalog.filter((book) => book.class_label === classLabel).length,
    })),
  });
});

app.get("/languages", (req, res) => {
  const classLabel = typeof req.query.class === "string" ? req.query.class : undefined;
  res.status(200).json({
    success: true,
    data: getLanguagesForClass(classLabel),
  });
});

app.get("/list", (req, res) => {
  const classLabel =
    typeof req.query.class === "string" ? req.query.class : undefined;
  const language =
    typeof req.query.language === "string" ? req.query.language : undefined;
  const search =
    typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";

  const data = booksCatalog.filter((book) => {
    if (classLabel && book.class_label !== classLabel) {
      return false;
    }
    if (language && book.language !== language) {
      return false;
    }
    if (
      search &&
      !`${book.title} ${book.subject} ${book.language}`.toLowerCase().includes(search)
    ) {
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
  const data = booksCatalog.filter((book) =>
    `${book.title} ${book.subject} ${book.language}`.toLowerCase().includes(query),
  );

  res.status(200).json({ success: true, data });
});

export const booksApp = app;
