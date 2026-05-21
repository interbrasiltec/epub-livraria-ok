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
  let totalServerRequests = 0;
  app.post("/api/enrich", async (req, res) => {
    const { title, author, fileName, isbn, userApiKey } = req.body;
    totalServerRequests++;

    console.log(`[AI Enrichment] Request received. [AI Request Counter] Total requests handled: ${totalServerRequests}`, { title, author, fileName, isbn, hasUserKey: !!userApiKey });

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
      console.log(`[AI Enrichment] Calling Gemini using server-side POST request and model fallback strategy...`);

      const modelsToTry = ["gemini-3.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
      let success = false;
      let responseText = "";
      let respStatus = 200;
      let lastErrorMsg = "";

      for (const modelToUse of modelsToTry) {
        try {
          console.log(`[AI Enrichment] Tentando modelo: "${modelToUse}"...`);
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
          console.log(`[AI Enrichment] Modelo "${modelToUse}" respondeu com Status HTTP: ${respStatus}`);

          if (resp.ok) {
            success = true;
            break;
          } else {
            console.warn(`[AI Enrichment] Modelo "${modelToUse}" retornou status de falha: ${respStatus}. Retorno: ${responseText.substring(0, 300)}`);
            lastErrorMsg = `Status ${respStatus}: ${responseText}`;
          }
        } catch (mErr: any) {
          console.error(`[AI Enrichment] Erro na requisição física para o modelo "${modelToUse}":`, mErr.message);
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
        return res.json(metadata);
      } catch (parseError: any) {
        console.error("[AI Enrichment] Response Parse/Validation Error:", parseError.message);
        throw parseError;
      }

    } catch (error: any) {
      console.error(`[AI Enrichment] Request failed:`, error.message || error);

      const isRateLimit = error.message?.includes("429");
      const isNotFound = error.message?.includes("404");
      const status: number = isNotFound ? 404 : (isRateLimit ? 429 : 500);

      return res.status(status).json({ 
        error: error.message || "Falha ao processar metadados com IA",
        details: error.toString(),
        code: status
      });
    }
  });

  // API Route: Test Gemini
  app.post("/api/test-gemini", async (req, res) => {
    const { userApiKey } = req.body || {};
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    console.log("TESTE GEMINI INICIADO NO SERVIDOR", { hasUserKey: !!userApiKey });
    
    if (!apiKey) {
      return res.status(400).json({ error: "Chave de API do Gemini não definida (nem enviada pelo cliente, nem definida nas variáveis de ambiente do servidor)." });
    }

    const modelsToTry = ["gemini-3.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    let lastError: any = null;
    let success = false;
    let responseData: any = null;
    let status = 200;

    for (const modelToUse of modelsToTry) {
      try {
        console.log(`[Test Gemini] Servidor testando modelo: "${modelToUse}"...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Diga apenas: API funcionando" }] }]
          })
        });

        status = resp.status;
        responseData = await resp.json();
        console.log(`[Test Gemini] Modelo "${modelToUse}" respondeu com status: ${status}`);

        if (resp.ok) {
          success = true;
          break;
        } else {
          lastError = responseData;
        }
      } catch (err: any) {
        console.error(`[Test Gemini] Erro ao testar modelo "${modelToUse}":`, err.message || err);
        lastError = err;
        status = 500;
        responseData = { error: err.message || "Erro durante teste de modelo" };
      }
    }

    console.log("STATUS FINAL DO TESTE:", status, "SUCCESS:", success);
    return res.status(status).json(responseData);
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
