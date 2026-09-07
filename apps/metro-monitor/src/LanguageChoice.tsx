import { MdSegmentedButton, MdSegmentedButtonSet } from "@awc-ui/react";
import { setLanguage, t } from "./i18n.mjs";
import { useLocale } from "./useLocale";

export function LanguageChoice({ compact = false }: { compact?: boolean }) {
  const language = useLocale();
  return (
    <MdSegmentedButtonSet
      className={`language-choice${compact ? " language-choice--compact" : ""}`}
      aria-label={t("Language")}
      onMdChange={(event) => setLanguage(event.detail[0])}
    >
      <MdSegmentedButton
        value="en"
        label="English"
        lang="en"
        selected={language === "en"}
      />
      <MdSegmentedButton
        value="ar"
        label="العربية"
        lang="ar"
        selected={language === "ar"}
      />
    </MdSegmentedButtonSet>
  );
}
