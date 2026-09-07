import common from "./locales/ar-common.js";
import views from "./locales/ar-views.js";
import auth from "./locales/ar-auth.js";
import feedback from "./locales/ar-feedback.js";
const arabic = { ...common, ...views, ...auth, ...feedback };
let language =
  typeof document !== "undefined" && document.documentElement.lang === "ar"
    ? "ar"
    : "en";
export const getLanguage = () => language;
export const locale = () => (language === "ar" ? "ar-EG" : "en-GB");
export function setLanguage(value) {
  language = value === "ar" ? "ar" : "en";
}
export const normalizeDigits = (value) =>
  String(value ?? "").replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= "۰" ? 0x06f0 : 0x0660)),
  );
export const number = (value, options = {}) =>
  new Intl.NumberFormat(locale(), options).format(value);
export function t(source, params = {}) {
  const key = String(source ?? "");
  let message = language === "ar" ? arabic[key] : key;
  if (message === undefined) message = translateGeneratedMessage(key);
  return message.replace(/\{(\w+)\}/g, (token, name) =>
    Object.hasOwn(params, name)
      ? typeof params[name] === "number"
        ? number(params[name])
        : String(params[name])
      : token,
  );
}
// Canonical domain records stay unchanged. Localize only known display patterns.
function translateGeneratedMessage(message) {
  if (message.includes(" · "))
    return message
      .split(" · ")
      .map((part) => t(part))
      .join(" · ");
  if (message.includes(" → "))
    return message
      .split(" → ")
      .map((part) => t(part))
      .join(" ← ");
  const prefixes = [
    ["Admitted to ", "Admitted to {department}", "department"],
    ["Registered in ", "Registered in {department}", "department"],
    ["Status: ", "Status: {status}", "status"],
    ["Assigned to ", "Assigned to {name}", "name"],
    ["Added by ", "Added by {name}", "name"],
  ];
  for (const [prefix, key, param] of prefixes) {
    if (message.startsWith(prefix)) {
      const value = message.slice(prefix.length);
      return t(key, { [param]: param === "name" ? value : t(value) });
    }
  }
  let match = message.match(/^(\d+) cases assigned$/);
  if (match) return t("{count} cases assigned", { count: Number(match[1]) });
  match = message.match(/^(CASE-\d+) is discharged and cannot be changed\.$/);
  if (match)
    return t("{id} is discharged and cannot be changed.", { id: match[1] });
  match = message.match(
    /^(.+) is (?:in surgery|off shift)\. Choose an available clinician\.$/,
  );
  if (match)
    return t("{name} is unavailable. Choose an available clinician.", {
      name: match[1],
    });
  match = message.match(
    /^(.+) has capacity for (\d+) more cases?\. Select fewer cases or choose another clinician\.$/,
  );
  if (match)
    return t(
      "{name} has capacity for {count} more cases. Select fewer cases or choose another clinician.",
      { name: match[1], count: Number(match[2]) },
    );
  return message;
}
