import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { parseGeminiResponse } from "./src/services/bookApi";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: AI Enrichment
  app.post("/api/enrich", async (req, res) => {
    const { title, author, fileName, isbn, userApiKey } = req.body;

    console.log("[AI Enrichment] Request received:", { title, author, fileName, isbn, hasUserKey: !!userApiKey });

    if (!title && !fileName) {
      return res.status(400).json({ error: "Title or fileName is required" });
    }

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "Chave de API do Gemini não definida. Forneça uma chave pessoal de API do Gemini ou configure a variável de ambiente GEMINI_API_KEY."
      });
    }

    const maxRetries = 3;
    let attempt = 0;

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

    while (attempt < maxRetries) {
      try {
        console.log(`[AI Enrichment] Calling Gemini (${attempt + 1}/${maxRetries}) using model gemini-2.0-flash with pure fetch...`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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

        const responseText = await resp.text();
        console.log(`[AI Enrichment] Response status: ${resp.status}`);

        if (!resp.ok) {
          if (resp.status === 404) {
            throw new Error("Erro 404: O modelo ou serviço da API do Gemini não foi encontrado. Certifique-se de que o modelo 'gemini-2.0-flash' esteja disponível sob sua chave API.");
          }
          if (resp.status === 429) {
            throw new Error("Erro 429: Limite de requisições excedido (Rate Limit). Aguarde alguns instantes antes de tentar novamente.");
          }
          let apiError = `Status ${resp.status}`;
          try {
            const parsedErr = JSON.parse(responseText.trim());
            apiError = parsedErr?.error?.message || apiError;
          } catch {}
          throw new Error(`Erro na API do Gemini: ${apiError}`);
        }

        let rawData: any;
        try {
          rawData = JSON.parse(responseText.trim());
        } catch (e) {
          throw new Error("A resposta retornada do Gemini não possui um formato JSON estruturado.");
        }

        const text = rawData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("A API do Gemini retornou uma resposta em formato inválido ou sem conteúdo textual.");
        }

        try {
          const metadata = parseGeminiResponse(text);
          return res.json(metadata);
        } catch (parseError: any) {
          console.error("[AI Enrichment] Response Parse/Validation Error:", parseError.message);
          throw parseError;
        }

      } catch (error: any) {
        attempt++;
        console.error(`[AI Enrichment] Attempt ${attempt} failed:`, error.message || error);

        const status: number = error.message?.includes("404") ? 404 : (error.message?.includes("429") ? 429 : 500);
        const isRetryable = 
          status === 503 || 
          status === 429 || 
          error.message?.includes("503") || 
          error.message?.includes("high demand") ||
          error.message?.includes("Unavailable");

        if (isRetryable && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.warn(`[AI Enrichment] Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return res.status(status).json({ 
          error: error.message || "Falha ao processar metadados com IA",
          details: error.toString(),
          code: status
        });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL ERROR: Failed to start server:", err);
  process.exit(1);
});
