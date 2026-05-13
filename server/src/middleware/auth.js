import { StatusCodes } from "http-status-codes";
import { supabase, supabaseAdmin } from "../lib/supabase.js";
import { httpError } from "../utils/httpError.js";

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      throw httpError(StatusCodes.UNAUTHORIZED, "Missing access token");
    }

    const {
      data: { user: authUser },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      throw httpError(StatusCodes.UNAUTHORIZED, "Invalid session");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) {
      throw httpError(StatusCodes.UNAUTHORIZED, "User profile not found");
    }

    req.user = profile;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}
