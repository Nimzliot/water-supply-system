import { z } from "zod";
import { aiStatus } from "../lib/gemini.js";
import { adminBriefing, askAdmin, askHousehold } from "../services/aiService.js";
import { MAP_POINTS, getMapLayout, saveMapLayout } from "../services/mapService.js";

const turnSchema = z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) });
const askSchema = z.object({
  question: z.string().trim().min(2, "Type a question first.").max(2000),
  history: z.array(turnSchema).max(20).default([])
});

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
    const { question, history } = askSchema.parse(req.body);
    const answer = await askAdmin({ userId: req.user.id, question, history });
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
    const { question, history } = askSchema.parse(req.body);
    const answer = await askHousehold({ user: req.user, question, history });
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

export async function saveMap(req, res, next) {
  try {
    res.json(await saveMapLayout(mapSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
}
