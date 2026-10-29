// Must match the profiles_username_format check constraint.
export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,30}$/;

export const USERNAME_RULES =
  "3–30 תווים באנגלית: אותיות, ספרות, נקודה, מקף או קו תחתון.";

// Supabase Auth needs an email, so new accounts get this generated address.
// It never receives mail; ".invalid" is a reserved domain that can't exist.
const AUTH_EMAIL_DOMAIN = "users.shiftsync.invalid";

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function usernameToAuthEmail(username: string) {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}
