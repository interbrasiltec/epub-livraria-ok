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
 * Realiza chamada direta para a API Gemini (v1beta/gemini-2.0-flash) compatível com chave pública gratuita.
 */
export async function callGeminiDirectly(
  title: string,
  author: string,
  isbn: string,
  fileName: string,
  apiKey: string
): Promise<ApiBookResult> {
  const prompt = `
    Você é um bibliotecário especialista em metadados de livros e crítico literário. 
    Encontre as informações corretas e detalhadas para o livro:
    - Título sugerido: "${title || "Desconhecido"}"
    - Autor sugerido: "${author || "Desconhecido"}"
    - ISBN: "${isbn || "N/A"}"
    - Nome do arquivo: "${fileName || ""}"

    Instruções adicionais de busca:
    1. Para encontrar avaliações precisas (Rating), você deve buscar em sites como Goodreads, Amazon Books ou Google Books.
    2. Se o livro for internacional, pesquise o título original em Inglês para obter mais avaliações do Goodreads.
    3. O Rating deve ser um número entre 1.0 e 5.0.
    4. O RatingCount deve ser o número aproximado de avaliações totais encontradas.

    Retorne um objeto JSON exatamente com os seguintes campos:
    - title: Título oficial corrigido
    - author: Nome oficial do autor
    - synopsis: Uma sinopse envolvente em português
    - genre: Gêneros literários principais
    - pageCount: número de páginas (inteiro) real
    - publicationDate: ano de publicação (pode ser string ou número)
    - publisher: editora principal
    - rating: número decimal entre 1.0 e 5.0
    - ratingCount: número inteiro de avaliações
    - coverUrl: URL da imagem da capa em alta resolução (prioridade para Open Library covers se tiver ISBN, senão Google Books ou similar)

    Seja preciso e profissional. Se não encontrar exatamente, use a melhor correspondência baseada no nome do arquivo.
  `;

  const modelToUse = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

  console.log(`[Browser Gemini] Requisitando modelo ${modelToUse} com CORS habilitado pelo browser...`);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
  } catch (fetchErr: any) {
    console.error("[Browser Gemini] Erro ao conectar:", fetchErr);
    throw new Error("Não foi possível conectar à API do Gemini. Verifique sua conexão com a internet.");
  }

  const responseText = await resp.text();
  console.log(`[Browser Gemini] Resposta HTTP recebida (${resp.status})`);

  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error(
        "Erro 404: O modelo ou endpoint solicitado não foi encontrado na API do Gemini. Certifique-se de usar uma chave de API válida com permissão para o modelo 'gemini-2.0-flash'."
      );
    }
    if (resp.status === 429) {
      throw new Error(
        "Limite de requisições excedido (Rate Limit / 429). Aguarde alguns instantes antes de tentar novamente ou verifique se sua cota foi alcançada."
      );
    }
    if (resp.status === 400) {
      if (responseText.includes("API key expired") || responseText.includes("API_KEY_INVALID")) {
        throw new Error("Chave de API do Gemini expirada ou inválida. Por favor, forneça uma chave ativa.");
      }
    }
    let errorMsg = `Erro ${resp.status}`;
    try {
      const errObj = JSON.parse(responseText);
      errorMsg = errObj?.error?.message || errorMsg;
    } catch (e) {}
    throw new Error(`Erro na API do Gemini: ${errorMsg}`);
  }

  let rawData: any;
  try {
    rawData = JSON.parse(responseText);
  } catch (e) {
    throw new Error("Erro ao processar resposta JSON da API Gemini.");
  }

  const text = rawData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("A API do Gemini retornou uma resposta sem texto.");
  }

  return parseGeminiResponse(text);
}

