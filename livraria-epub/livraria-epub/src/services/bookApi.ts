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

/**
 * Trata e valida a resposta recebida da API Gemini, prevenindo quebras de aplicativo
 * quando o retorno não é um JSON válido (como HTML, texto simples ou respostas vazias)
 * e limpando blocos de marcação de código JSON antes do parse.
 */
export function parseGeminiResponse(responseText: string): ApiBookResult {
  if (!responseText || !responseText.trim()) {
    throw new Error("Resposta da IA está vazia.");
  }

  const trimmed = responseText.trim();

  // Validação: Detecta se a resposta é um HTML retornado por falhas de proxy, gateways ou erros do Cloud Run
  if (
    trimmed.startsWith("<!DOCTYPE") || 
    trimmed.startsWith("<html") || 
    trimmed.startsWith("<div") || 
    trimmed.includes("<html>") || 
    trimmed.includes("<body>")
  ) {
    throw new Error(
      "Erro ao interpretar resposta da IA. O servidor retornou uma página HTML em vez de dados estruturados. A API pode estar temporariamente indisponível ou em limite de uso."
    );
  }

  // Validação: Detecta se a resposta parece ser um erro de limite da API (ex: 429) em texto simples
  if (
    trimmed.includes("RESOURCE_EXHAUSTED") ||
    trimmed.includes("Quota exceeded") ||
    trimmed.includes("429") ||
    trimmed.includes("rate limit")
  ) {
    throw new Error(
      "Limite de requisições excedido (Rate Limit / 429). Aguarde alguns instantes antes de tentar novamente ou use uma chave API pessoal do Gemini."
    );
  }

  try {
    // Remove blocos de marcação ```json e ``` antes de fazer o parse
    const clean = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Validação: Se não começar com chaves ou colchetes, não é um JSON válido (é texto simples)
    if (!clean.startsWith("{") && !clean.startsWith("[")) {
      throw new Error("A resposta retornada não possui um formato JSON estruturado.");
    }

    const data = JSON.parse(clean);

    // Validação de campos essenciais (garantir estrutura básica segura)
    if (typeof data !== "object" || data === null) {
      throw new Error("Estrutura de dados inválida.");
    }

    return data as ApiBookResult;
  } catch (error) {
    console.error("Resposta inválida da IA:", responseText);

    throw new Error(
      "Erro ao interpretar resposta da IA. A API pode estar temporariamente indisponível ou em limite de uso."
    );
  }
}

