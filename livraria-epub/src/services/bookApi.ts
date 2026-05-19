import { BookMetadata } from "../types";

export interface ApiBookResult {
  title?: string;
  author?: string;
  synopsis?: string;
  genre?: string;
  pageCount?: number;
  publicationDate?: string;
  publisher?: string;
  coverUrl?: string;
  isbn?: string;
}

/**
 * Normalizes title for better search results
 */
export function normalizeSearchTerm(term: string): string {
  if (!term) return "";
  
  let clean = term
    .replace(/\.(epub|pdf|mobi|azw3)$/i, "") // Remove extensions
    .replace(/\[.*?\]/g, "") // Remove content in brackets
    .replace(/\(.*?\)/g, "") // Remove content in parentheses
    .replace(/[\{\}]/g, "") // Remove braces
    .replace(/(PTBR|revisado|completo|v\d+|OCR|scan|edição digital|digital edition|ebook|e-book|ilustrado|pocket|audiobook)/gi, "") // Remove common tags
    .replace(/[-_@#$%^&*()_+={}\[\]|\\:;"'<,>.?/~`]/g, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  return clean;
}
