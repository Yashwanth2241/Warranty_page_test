const path = require("node:path");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
const appsScriptToken = process.env.GOOGLE_APPS_SCRIPT_TOKEN?.trim();

app.use(express.json({ limit: "8kb" }));
app.get("/", (request, response) => response.sendFile(path.join(__dirname, "index.html")));

const registrationLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

function validateDraft(body) {
  const { registrationId, revision, fullName, phoneNumber, email, purchaseDate, invoiceNumber } = body || {};
  const isUuid = typeof registrationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId);
  const isRevision = Number.isSafeInteger(revision) && revision >= 0;
  const fields = [fullName, phoneNumber, email, purchaseDate, invoiceNumber];
  const areFieldsValid = fields.every(value => typeof value === "string" && value.length <= 200);

  return isUuid && isRevision && areFieldsValid;
}

async function saveDraftInAppsScript(draft) {
  if (!appsScriptUrl || !appsScriptToken) {
    throw new Error("Set GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_TOKEN in .env.");
  }

  const endpoint = new URL(appsScriptUrl);
  if (endpoint.protocol !== "https:" || endpoint.hostname !== "script.google.com" || !endpoint.pathname.startsWith("/macros/s/") || !endpoint.pathname.endsWith("/exec")) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL must be a deployed script.google.com web app URL ending in /exec.");
  }

  const remoteResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...draft, apiToken: appsScriptToken }),
    signal: AbortSignal.timeout(15000)
  });
  const responseBody = await remoteResponse.json();

  if (!remoteResponse.ok || responseBody.saved !== true) {
    throw new Error(responseBody.error || "Apps Script did not confirm the save.");
  }
}

app.post("/api/registration", registrationLimit, async (request, response) => {
  if (!validateDraft(request.body)) {
    return response.status(400).json({ error: "Invalid registration data." });
  }

  try {
    await saveDraftInAppsScript(request.body);
    return response.json({ saved: true });
  } catch (error) {
    console.error("Apps Script save failed:", error.message);
    const configured = Boolean(appsScriptUrl && appsScriptToken);
    const status = configured ? 502 : 503;
    return response.status(status).json({
      error: configured ? "Could not save to Google Sheets." : "Apps Script is not configured. Follow README.md to set it up."
    });
  }
});

app.listen(port, () => {
  console.log(`Warranty registration app running at http://localhost:${port}`);
});