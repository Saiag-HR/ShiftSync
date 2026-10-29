// Usernames may use any language, spaces and capitals. They are stored as
// typed (after normalizing), and compared case-insensitively through
// profiles.username_key. Must match normalize_username() and the
// profiles_username_valid check in the database.

export const USERNAME_MAX_LENGTH = 50;

export const USERNAME_RULES = `עד ${USERNAME_MAX_LENGTH} תווים. אפשר עברית, אנגלית, מספרים ורווחים.`;

// Unicode NFC, trimmed, with runs of whitespace collapsed to one space.
export function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

// The value stored in profiles.username_key, used for lookups.
export function usernameKey(username: string) {
  return normalizeUsername(username).toLowerCase();
}

export function isValidUsername(username: string) {
  return username.length > 0 && username.length <= USERNAME_MAX_LENGTH;
}

// Supabase Auth needs an email, so each account gets a generated address
// that never receives mail (".invalid" is a reserved domain). It isn't
// derived from the username, which may contain characters emails can't.
export function generateAuthEmail() {
  return `${crypto.randomUUID()}@users.shiftsync.invalid`;
}
