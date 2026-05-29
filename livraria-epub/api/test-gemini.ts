import { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { userApiKey } = req.body || {};
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  console.log("[Vercel Serverless Test] Test Gemini started", { hasUserKey: !!userApiKey });
  
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
      console.log(`[Vercel Serverless Test] Servidor testando modelo: "${modelToUse}"...`);
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
      console.log(`[Vercel Serverless Test] Modelo "${modelToUse}" respondeu with status: ${status}`);

      if (resp.ok) {
        success = true;
        break;
      } else {
        lastError = responseData;
      }
    } catch (err: any) {
      console.error(`[Vercel Serverless Test] Erro ao testar modelo "${modelToUse}":`, err.message || err);
      lastError = err;
      status = 500;
      responseData = { error: err.message || "Erro durante teste de modelo" };
    }
  }

  console.log("[Vercel Serverless Test] Final status of test:", status, "SUCCESS:", success);
  return res.status(status).json(responseData);
}
