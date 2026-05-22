import { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

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

export function parseGeminiResponse(responseText: string): ApiBookResult {
  if (!responseText || !responseText.trim()) {
    throw new Error("Resposta da IA está vazia.");
  }

  const trimmed = responseText.trim();

  // Validação: Detecta se a resposta é um HTML retornado por falhas de proxy, gateways ou erros
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

    // Validação: Se não começar com chaves ou colchetes, não é um JSON válido
    if (!clean.startsWith("{") && !clean.startsWith("[")) {
      throw new Error("A resposta retornada não possui um formato JSON estruturado.");
    }

    const data = JSON.parse(clean);

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

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { title, author, fileName, isbn, userApiKey } = req.body || {};

  console.log(`[Vercel Serverless AI] Request received`, { title, author, fileName, isbn, hasUserKey: !!userApiKey });

  if (!title && !fileName) {
    return res.status(400).json({ error: "Title or fileName is required" });
  }

  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: "Chave de API do Gemini não definida. Forneça uma chave pessoal de API do Gemini ou configure a variável de ambiente GEMINI_API_KEY."
    });
  }

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

  try {
    console.log(`[Vercel Serverless AI] Calling Gemini with model fallback strategy...`);

    const modelsToTry = ["gemini-3.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    let success = false;
    let responseText = "";
    let respStatus = 200;
    let lastErrorMsg = "";

    for (const modelToUse of modelsToTry) {
      try {
        console.log(`[Vercel Serverless AI] Tentando modelo: "${modelToUse}"...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

        const resp = await fetch(url, {
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

        respStatus = resp.status;
        responseText = await resp.text();
        console.log(`[Vercel Serverless AI] Modelo "${modelToUse}" respondeu com Status HTTP: ${respStatus}`);

        if (resp.ok) {
          success = true;
          break;
        } else {
          console.warn(`[Vercel Serverless AI] Modelo "${modelToUse}" retornou status de falha: ${respStatus}. Retorno: ${responseText.substring(0, 300)}`);
          lastErrorMsg = `Status ${respStatus}: ${responseText}`;
        }
      } catch (mErr: any) {
        console.error(`[Vercel Serverless AI] Erro na requisição física para o modelo "${modelToUse}":`, mErr.message);
        lastErrorMsg = mErr.message;
      }
    }

    if (!success) {
      throw new Error(`A API do Gemini rejeitou todos os modelos tentados. Último erro: ${lastErrorMsg}`);
    }

    let rawData: any;
    try {
      rawData = JSON.parse(responseText.trim());
    } catch (e) {
      throw new Error("A resposta retornada do Gemini não possui um formato JSON estruturado válido.");
    }

    const text = rawData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("A API do Gemini retornou uma resposta em formato inválido ou sem conteúdo textual nos candidates.");
    }

    try {
      const metadata = parseGeminiResponse(text);
      return res.status(200).json(metadata);
    } catch (parseError: any) {
      console.error("[Vercel Serverless AI] Response Parse/Validation Error:", parseError.message);
      throw parseError;
    }

  } catch (error: any) {
    console.error(`[Vercel Serverless AI] Request failed:`, error.message || error);

    const isRateLimit = error.message?.includes("429");
    const isNotFound = error.message?.includes("404");
    const status: number = isNotFound ? 404 : (isRateLimit ? 429 : 500);

    return res.status(status).json({ 
      error: error.message || "Falha ao processar metadados com IA",
      details: error.toString(),
      code: status
    });
  }
}
