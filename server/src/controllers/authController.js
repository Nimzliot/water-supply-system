import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabase, supabaseAdmin } from "../lib/supabase.js";
import { httpError } from "../utils/httpError.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().min(8),
  address: z.string().min(5),
  family_members: z.number().int().min(1),
  service_number: z.string().min(3),
  password: z.string().min(5)
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(5)
});

export async function register(req, res, next) {
  try {
    const payload = registerSchema.parse(req.body);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { name: payload.name, role: "user" }
    });

    if (authError) {
      throw httpError(StatusCodes.BAD_REQUEST, authError.message);
    }

    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      role: "user",
      name: payload.name,
      email: payload.email,
      mobile: payload.mobile,
      address: payload.address,
      family_members: payload.family_members,
      service_number: payload.service_number
    });

    if (profileError) {
      throw httpError(StatusCodes.BAD_REQUEST, profileError.message);
    }

    res.status(StatusCodes.CREATED).json({ message: "Household registration successful" });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    let email = payload.identifier;

    if (!payload.identifier.includes("@")) {
      const { data: mappedUser, error: lookupError } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("service_number", payload.identifier)
        .maybeSingle();

      if (lookupError || !mappedUser?.email) {
        throw httpError(StatusCodes.UNAUTHORIZED, "Invalid service number, email, or password");
      }

      email = mappedUser.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: payload.password
    });
    if (error || !data.session || !data.user) {
      throw httpError(StatusCodes.UNAUTHORIZED, error?.message || "Login failed");
    }

    const { data: profile } = await supabaseAdmin.from("users").select("*").eq("id", data.user.id).single();
    res.json({ session: data.session, user: profile });
  } catch (error) {
    if (error?.name === "TypeError" && error?.cause?.code === "ENOTFOUND") {
      return next(httpError(StatusCodes.SERVICE_UNAVAILABLE, "Authentication service is unavailable. Check your Supabase URL and network connection."));
    }

    next(error);
  }
}

export async function logout(req, res) {
  res.json({ message: "Logged out" });
}

export async function getProfile(req, res) {
  res.json({ user: req.user });
}
