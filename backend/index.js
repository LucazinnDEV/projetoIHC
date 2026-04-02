import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());

const allowedOrigin = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: allowedOrigin }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/groq", async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Campo 'messages' inválido" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY não configurada no backend" });
    }

    const payload = {
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.5,
      max_tokens: 500,
    };

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      return res.status(groqResponse.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: "Falha no backend ao consultar Groq" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend iniciado na porta ${port}`);
});
