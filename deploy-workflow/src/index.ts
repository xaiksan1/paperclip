import express from "express";
import { start, getRun } from "workflow/api";
import { deployPaperclip } from "../workflows/deploy.js";

const app = express();
app.use(express.json());

// POST /api/deploy — trigger a new deploy workflow run
app.post("/api/deploy", async (req, res) => {
  try {
    const run = await start(deployPaperclip);
    res.json({ runId: run.runId, status: "started" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/deploy/:runId — poll status
app.get("/api/deploy/:runId", async (req, res) => {
  try {
    const run = getRun(req.params.runId);
    const result = await Promise.race([
      run.returnValue.then((v) => ({ done: true, result: v })),
      new Promise<{ done: false }>((r) => setTimeout(() => r({ done: false }), 200)),
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;
