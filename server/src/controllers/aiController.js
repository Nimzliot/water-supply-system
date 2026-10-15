import { z } from "zod";
import { aiStatus } from "../lib/gemini.js";
import { adminBriefing, askAdmin, askHousehold } from "../services/aiService.js";
import { MAP_POINTS, getMapLayout, previewRoutes, saveMapLayout } from "../services/mapService.js";

const turnSchema = z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) });
// A photo as the browser sends it: resized, re-encoded as JPEG (or PNG/WebP) and base64 encoded.
const imageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().regex(/^[A-Za-z0-9+/=]+$/, "The image is not valid base64.").max(2_500_000, "That image is too large. Try a smaller one.")
});
const askSchema = z
  .object({
    question: z.string().trim().max(2000).default(""),
    images: z.array(imageSchema).max(3, "Send at most 3 images at a time.").default([]),
    history: z.array(turnSchema).max(30).default([])
  })
  .refine((value) => value.question.length >= 2 || value.images.length > 0, { message: "Type a question or add an image." });

const latLng = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
const mapSchema = z.object({
  center: latLng,
  zoom: z.number().min(3).max(21),
  points: z.object(Object.fromEntries(MAP_POINTS.map((key) => [key, latLng])))
});

export function getAiStatus(req, res) {
  res.json({ ai: aiStatus() });
}

export async function adminAsk(req, res, next) {
  try {
    const { question, images, history } = askSchema.parse(req.body);
    const answer = await askAdmin({ userId: req.user.id, question, images, history });
    res.json({ answer });
  } catch (error) {
    next(error);
  }
}

export async function adminInsight(req, res, next) {
  try {
    const briefing = await adminBriefing({ userId: req.user.id, fresh: req.query.fresh === "1" });
    res.json(briefing);
  } catch (error) {
    next(error);
  }
}

export async function householdAsk(req, res, next) {
  try {
    const { question, images, history } = askSchema.parse(req.body);
    const answer = await askHousehold({ user: req.user, question, images, history });
    res.json({ answer });
  } catch (error) {
    next(error);
  }
}

export async function getMap(req, res, next) {
  try {
    res.json(await getMapLayout());
  } catch (error) {
    next(error);
  }
}

export async function previewMapRoutes(req, res, next) {
  try {
    const { points } = mapSchema.pick({ points: true }).parse(req.body);
    res.json(await previewRoutes(points));
  } catch (error) {
    next(error);
  }
}

export async function saveMap(req, res, next) {
  try {
    res.json(await saveMapLayout(mapSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
}
