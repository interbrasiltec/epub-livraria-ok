import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Initialization (Lazy check for API Key)
  const getGenAI = (customKey?: string) => {
    const apiKey = customKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables. Por favor, forneça uma chave API pessoal nas configurações.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

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

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const ai = getGenAI(userApiKey);
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

          Retorne um objeto JSON com os seguintes campos:
          - title: Título oficial corrigido
          - author: Nome oficial do autor
          - synopsis: Uma sinopse envolvente em português
          - genre: Gêneros literários principais
          - pageCount: número de páginas real
          - publicationDate: ano de publicação
          - publisher: editora principal
          - rating: número (1.0 a 5.0) obtido de fontes como Goodreads/Amazon
          - ratingCount: número total de avaliações
          - coverUrl: URL da imagem da capa em alta resolução (prioridade para Open Library covers se tiver ISBN, senão Google Books ou similar)

          Seja preciso e profissional. Se não encontrar exatamente, use a melhor correspondência baseada no nome do arquivo.
        `;

        console.log(`[AI Enrichment] Calling Gemini (${attempt + 1}/${maxRetries}) using model gemini-3.5-flash...`);

        const response = await ai.models.generateContent({ 
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const text = response.text;
        
        console.log("[AI Enrichment] AI Response length:", text?.length || 0);

        if (!text) {
          throw new Error("A IA retornou uma resposta vazia.");
        }
        
        try {
          const metadata = JSON.parse(text);
          return res.json(metadata);
        } catch (parseError) {
          console.error("[AI Enrichment] JSON Parse Error. Raw text:", text);
          throw new Error("Falha ao processar resposta JSON da IA.");
        }

      } catch (error: any) {
        attempt++;
        console.error(`[AI Enrichment] Attempt ${attempt} failed:`, error.message || error);

        const status = error.status || 500;
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
          error: error.message || "Failed to validate metadata with AI",
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
