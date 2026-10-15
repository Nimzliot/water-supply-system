import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Photos take longer to read than text.
const TIMEOUT_MS = 45000;

export function aiStatus() {
  return {
    configured: Boolean(env.geminiApiKey),
    model: env.geminiModel,
    help: env.geminiApiKey ? "" : "Add GEMINI_API_KEY to server/.env (get one at https://aistudio.google.com/apikey) and restart the server."
  };
}

// One Gemini call. messages: [{ role: "user" | "model", text, images? }], oldest first, where
// images are [{ mimeType, data }] with data as base64 (the browser resizes and encodes them).
// Returns the reply text, or throws an httpError with a message the dashboard can show.
export async function generateText({ system, messages, temperature = 0.4, maxOutputTokens = 2048 }) {
  if (!env.geminiApiKey) {
    throw httpError(StatusCodes.SERVICE_UNAVAILABLE, `The AI assistant is not set up. ${aiStatus().help}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(env.geminiModel)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((message) => ({
          role: message.role === "model" ? "model" : "user",
          parts: [
            ...(message.images || []).map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } })),
            { text: message.text || "Describe this image." }
          ]
        })),
        generationConfig: { temperature, maxOutputTokens }
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    throw httpError(StatusCodes.BAD_GATEWAY, timedOut ? "The AI took too long to answer. Try again." : `Could not reach Gemini: ${error.message}`);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body?.error?.message || response.statusText;
    if (response.status === 400 && /api key/i.test(detail)) throw httpError(StatusCodes.SERVICE_UNAVAILABLE, "Gemini rejected the API key. Check GEMINI_API_KEY in server/.env.");
    if (response.status === 403) throw httpError(StatusCodes.SERVICE_UNAVAILABLE, `Gemini refused the request: ${detail}`);
    if (response.status === 404) throw httpError(StatusCodes.SERVICE_UNAVAILABLE, `Gemini has no model named "${env.geminiModel}". Set GEMINI_MODEL in server/.env to a current model.`);
    if (response.status === 429) throw httpError(StatusCodes.TOO_MANY_REQUESTS, "The Gemini free limit was reached. Wait a minute and try again.");
    throw httpError(StatusCodes.BAD_GATEWAY, `Gemini error: ${detail}`);
  }

  const candidate = body.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((part) => part.text || "").join("").trim();
  if (!text) {
    const reason = candidate?.finishReason || body.promptFeedback?.blockReason || "no answer";
    throw httpError(StatusCodes.BAD_GATEWAY, `Gemini returned no answer (${reason}). Try asking another way.`);
  }
  return text;
}
