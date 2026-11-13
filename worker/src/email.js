const MAX_EMAIL_LENGTH = 254;

// Basic contact-address validation, with bounded input and no backtracking.
function isEmail(value) {
  if (typeof value !== "string" || value.length > MAX_EMAIL_LENGTH || /\s/u.test(value)) return false;
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  // Require a character on both sides of the domain's separating dot.
  const dot = value.indexOf(".", at + 2);
  return dot > at + 1 && dot < value.length - 1;
}

export { isEmail, MAX_EMAIL_LENGTH };
