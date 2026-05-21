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

/**
 * Realiza a chamada do Gemini através do endpoint de proxy do servidor (/api/enrich),
 * evitando vazamentos de CORS, problemas com CSP de PWA e restrições de sandbox de iFrame no browser.
 * A chave pessoal de API configurada pelo usuário é repassada com segurança via payload POST.
 */
export async function callGeminiDirectly(
  title: string,
  author: string,
  isbn: string,
  fileName: string,
  apiKey?: string
): Promise<ApiBookResult> {
  console.log("[Browser Gemini] TESTE OU SINCRONIZAÇÃO INICIADA");
  console.log(`[Browser Gemini] Dados do livro: "${title}" por "${author || "não informado"}" (ISBN: ${isbn || "N/A"})`);
  console.log(`[Browser Gemini] Chave de API pessoal fornecida pelo cliente?`, !!apiKey);

  const requestPayload = {
    title,
    author,
    isbn,
    fileName,
    userApiKey: apiKey || ""
  };

  console.log("[Browser Gemini] Enviando requisição POST para o proxy /api/enrich com payload:", JSON.stringify({ ...requestPayload, userApiKey: apiKey ? "***REDACTED***" : "" }));

  let resp: Response;
  try {
    resp = await fetch("/api/enrich", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });
  } catch (fetchErr: any) {
    console.error("[Browser Gemini] Falha de comunicação de rede ou CORS local:", fetchErr);
    throw new Error(`Não foi possível conectar ao servidor proxy de enriquecimento de IA: ${fetchErr.message || fetchErr}`);
  }

  console.log(`[Browser Gemini] Resposta HTTP recebida do proxy com Status: ${resp.status}`);
  const responseText = await resp.text();

  if (!resp.ok) {
    let errorMsg = `Erro ${resp.status}`;
    try {
      const errObj = JSON.parse(responseText.trim());
      errorMsg = errObj?.error || errObj?.details || errorMsg;
    } catch {
      errorMsg = responseText || errorMsg;
    }
    console.error(`[Browser Gemini] Servidor retornou erro: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    // A resposta do /api/enrich já retorna direto o objeto de metadados parseado e validado pelo servidor!
    console.log("[Browser Gemini] Resposta do proxy recebida com sucesso e interpretada.");
    const parsedData = JSON.parse(responseText.trim());
    return parsedData as ApiBookResult;
  } catch (err: any) {
    console.error("[Browser Gemini] Erro inesperado ao converter resposta em JSON:", err);
    throw new Error("Erro ao interpretar resposta estruturada de metadados retornada pelo servidor.");
  }
}

