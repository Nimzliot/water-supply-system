import { ZodError } from "zod";

// PostgREST / Postgres codes for a table or column the database does not have yet.
const MISSING_SCHEMA_CODES = new Set(["PGRST204", "PGRST205", "42P01", "42703"]);

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: error.issues[0]?.message || "Validation failed",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (MISSING_SCHEMA_CODES.has(error?.code)) {
    console.error(error);
    return res.status(503).json({
      message: "The database is missing a table or column this feature needs. Run the files in supabase/migrations (001, 002, 003) in the Supabase SQL editor."
    });
  }

  const status = error.status || 500;
  const message = error.message || "Internal server error";

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ message });
}
