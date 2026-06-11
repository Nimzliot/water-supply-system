import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function fixAdmin() {
  const email = "admin1@gmail.com";
  console.log(`Looking up user with email: ${email}`);

  // 1. Find user in public.users table
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !user) {
    console.error("User not found in public.users table. Did you register them?", error?.message);
    return;
  }

  console.log(`Found user: ${user.id}. Current role: ${user.role}`);

  if (user.role === "admin") {
    console.log("User is already an admin in the database!");
  } else {
    // 2. Update role to admin
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ role: "admin" })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update role:", updateError.message);
      return;
    }
    console.log("Successfully updated user role to 'admin'!");
  }
}

fixAdmin();
