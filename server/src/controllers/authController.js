import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { supabase, supabaseAdmin } from "../lib/supabase.js";
import { httpError } from "../utils/httpError.js";
import { env } from "../config/env.js";

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

const refreshSchema = z.object({ refresh_token: z.string().min(10) });
const changePasswordSchema = z.object({ current_password: z.string().min(1), new_password: z.string().min(5) });
const forgotPasswordSchema = z.object({ identifier: z.string().min(3) });
const resetPasswordSchema = z.object({ access_token: z.string().min(10), password: z.string().min(5) });

export async function register(req, res, next) {
  try {
    const payload = registerSchema.parse(req.body);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("service_number", payload.service_number)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      throw httpError(StatusCodes.CONFLICT, "This service number is already registered");
    }

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
      // Without a profile the auth user can never log in, and it would block re-registering the email.
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
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

export async function refresh(req, res, next) {
  try {
    const { refresh_token } = refreshSchema.parse(req.body);
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      throw httpError(StatusCodes.UNAUTHORIZED, "Session expired. Please log in again.");
    }

    res.json({ session: data.session });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = changePasswordSchema.parse(req.body);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: req.user.email, password: current_password });
    if (signInError) {
      throw httpError(StatusCodes.BAD_REQUEST, "Your current password is not correct.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: new_password });
    if (error) throw httpError(StatusCodes.BAD_REQUEST, error.message);

    res.json({ message: "Password changed." });
  } catch (error) {
    next(error);
  }
}

// Emails a reset link. The answer is the same whether or not the account exists.
export async function forgotPassword(req, res, next) {
  try {
    const { identifier } = forgotPasswordSchema.parse(req.body);
    let email = identifier;

    if (!identifier.includes("@")) {
      const { data } = await supabaseAdmin.from("users").select("email").eq("service_number", identifier).maybeSingle();
      email = data?.email;
    }

    if (email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.clientOrigin}/reset-password` });
      if (error) console.warn("[auth] Could not send reset email:", error.message);
    }

    res.json({ message: "If that account exists, a reset link has been sent to its email address." });
  } catch (error) {
    next(error);
  }
}

// Completes a reset using the token from the emailed link.
export async function resetPassword(req, res, next) {
  try {
    const { access_token, password } = resetPasswordSchema.parse(req.body);
    const { data, error } = await supabase.auth.getUser(access_token);
    if (error || !data?.user) {
      throw httpError(StatusCodes.BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.");
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, { password });
    if (updateError) throw httpError(StatusCodes.BAD_REQUEST, updateError.message);

    res.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res) {
  res.json({ message: "Logged out" });
}

export async function getProfile(req, res) {
  res.json({ user: req.user });
}
