import { useSyncExternalStore } from "react";
import { getLanguage, subscribeLanguage } from "./i18n.mjs";

export const useLocale = () =>
  useSyncExternalStore(subscribeLanguage, getLanguage, () => "en");
