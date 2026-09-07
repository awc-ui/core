import { arabic } from "./ar.mjs";
import {
  applyAppearance,
  readAppearance,
  saveAppearance,
} from "./appearance.mjs";

export const LANGUAGE_KEY = "metro-language";
export const normalizeLanguage = (value) => (value === "ar" ? "ar" : "en");
export function readLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return "en";
  }
}
let language = readLanguage();
const listeners = new Set();
export const getLanguage = () => language;
export const getLocale = () => (language === "ar" ? "ar" : "en-US");
export function subscribeLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function initializeLanguage() {
  document.documentElement.lang = language;
}
export function setLanguage(value) {
  const next = normalizeLanguage(value);
  if (next === language) return;
  language = next;
  document.documentElement.lang = language;
  const appearance = {
    ...readAppearance(),
    direction: language === "ar" ? "rtl" : "ltr",
  };
  applyAppearance(appearance);
  saveAppearance(appearance);
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {}
  for (const listener of listeners) listener();
}
export function translateText(key, params = {}, selectedLanguage = language) {
  const source = String(key ?? "");
  const message = String(
    selectedLanguage === "ar" ? arabic[source] || source : source,
  );
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
export const t = translateText;
export function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(getLocale(), options).format(Number(value));
}
export function localizedMessage(message) {
  const retry = /^Too many attempts\. Try again in (\d+) seconds\.$/.exec(
    message,
  );
  return retry
    ? t("Too many attempts. Try again in {seconds} seconds.", {
        seconds: formatNumber(retry[1]),
      })
    : t(message);
}
export function normalizeDigits(value) {
  return String(value).replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= "\u06f0" ? 0x6f0 : 0x660)),
  );
}
export function countLabel(value, noun) {
  const count = formatNumber(value);
  if (language !== "ar")
    return `${count} ${value === 1 ? noun.slice(0, -1) : noun}`;
  const forms =
    noun === "trains"
      ? {
          zero: "لا قطارات",
          one: "قطار واحد",
          two: "قطاران",
          few: "{count} قطارات",
          many: "{count} قطارًا",
          other: "{count} قطار",
        }
      : {
          zero: "لا محطات",
          one: "محطة واحدة",
          two: "محطتان",
          few: "{count} محطات",
          many: "{count} محطة",
          other: "{count} محطة",
        };
  return forms[new Intl.PluralRules("ar").select(value)].replace(
    "{count}",
    count,
  );
}
