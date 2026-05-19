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

  // Gemini API Initialization
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route: AI Enrichment
  app.post("/api/enrich", async (req, res) => {
    const { title, author, fileName, isbn } = req.body;

    if (!title && !fileName) {
      return res.status(400).json({ error: "Title or fileName is required" });
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
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

          Retorne APENAS um objeto JSON válido (sem blocos markdown) com os seguintes campos:
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

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview", 
          contents: prompt,
        });

        const text = response.text || "{}";
        
        // Attempt to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const metadata = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");

        return res.json(metadata);
      } catch (error: any) {
        attempt++;
        const isRetryable = error.status === 503 || error.status === 429 || (error.message && error.message.includes("503"));
        
        if (isRetryable && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.warn(`[AI Enrichment] Attempt ${attempt} failed with 503/429. Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error("Enrichment error after retries:", error);
        return res.status(error.status || 500).json({ 
          error: error.message || "Failed to enrich metadata",
          code: error.status
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

startServer();
