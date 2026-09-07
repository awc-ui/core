import { t, getLocale } from "./i18n.mjs";
import { useEffect, useRef, useState } from "react";
import {
  MdButton,
  MdColorPicker,
  MdIconButton,
  MdSegmentedButton,
  MdSegmentedButtonSet,
  MdSelect,
  MdSelectOption,
  MdSideSheet,
  MdSwitch,
} from "@awc-ui/react";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  readAppearance,
  saveAppearance,
} from "./appearance.mjs";
import "./appearance.css";
import { useLocale } from "./useLocale";
import { LanguageChoice } from "./LanguageChoice";

export function MakeItYours({
  open,
  onClose,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme: string;
  onToggleTheme: () => void;
}) {
  const language = useLocale();
  const [appearance, setAppearance] = useState(readAppearance);
  const [saved, setSaved] = useState(true);
  const latest = useRef(appearance);
  const frame = useRef<number>();
  useEffect(() => {
    const next = readAppearance();
    latest.current = next;
    setAppearance(next);
  }, [language]);
  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  const change = (patch: Partial<typeof appearance>, commit = true) => {
    const next = normalizeAppearance({ ...latest.current, ...patch });
    latest.current = next;
    setAppearance(next);
    cancelAnimationFrame(frame.current ?? 0);
    if (commit) {
      applyAppearance(next);
      setSaved(saveAppearance(next));
    } else {
      frame.current = requestAnimationFrame(() => applyAppearance(next));
    }
  };

  return (
    <MdSideSheet
      id="metro-appearance"
      className="appearance-sheet"
      variant="modal"
      headline={t("Make it yours")}
      aria-label={t("Make it yours")}
      open={open}
      topDivider
      bottomDivider
      onMdClose={(event) => {
        // Nested selects also emit mdClose; only the sheet dismisses this panel.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <MdIconButton
        slot="close"
        icon="close"
        aria-label={t("Close settings")}
        onMdClick={onClose}
      />
      <section
        className="appearance-section appearance-language"
        aria-labelledby="appearance-language"
      >
        <h3 id="appearance-language">{t("Language")}</h3>
        <LanguageChoice />
      </section>
      <p className="appearance-intro">
        {t("Your control room, your preferences.")}
      </p>
      <section
        className="appearance-section"
        aria-labelledby="appearance-theme"
      >
        <h3 id="appearance-theme">{t("Appearance")}</h3>
        <MdSegmentedButtonSet
          className="appearance-choices"
          aria-label={t("Appearance")}
          onMdChange={(event) => {
            if (event.detail[0] !== theme) onToggleTheme();
          }}
        >
          <MdSegmentedButton
            value="light"
            label={t("Light")}
            icon="light_mode"
            selected={theme === "light"}
          />
          <MdSegmentedButton
            value="dark"
            label={t("Dark")}
            icon="dark_mode"
            selected={theme === "dark"}
          />
        </MdSegmentedButtonSet>
      </section>
      <section
        className="appearance-section"
        aria-labelledby="appearance-primary"
      >
        <h3 id="appearance-primary">{t("Primary color")}</h3>
        <MdColorPicker
          locale={getLocale()}
          variant="inline"
          format="hex"
          aria-label={t("Primary color")}
          value={appearance.primary}
          presets="#3658cf,#7c3aed,#087f8c,#2e7d32,#b64c15,#c42c69"
          showInputs={false}
          onMdInput={(event) => change({ primary: event.detail.value }, false)}
          onMdChange={(event) => change({ primary: event.detail.value })}
        />
      </section>
      <section
        className="appearance-section"
        aria-labelledby="appearance-density"
      >
        <h3 id="appearance-density">{t("Density")}</h3>
        <MdSelect
          name="appearanceDensity"
          label={t("Interface density")}
          fullWidth
          value={String(appearance.density)}
          onMdChange={(event) => change({ density: Number(event.detail) })}
        >
          <MdSelectOption value="0" label={t("Comfortable")} />
          <MdSelectOption value="-1" label={t("Cozy · default")} />
          <MdSelectOption value="-2" label={t("Compact")} />
          <MdSelectOption value="-3" label={t("Dense")} />
          <MdSelectOption value="-4" label={t("Extra dense")} />
        </MdSelect>
      </section>
      <div className="appearance-direction">
        <div>
          <h3>{t("Right-to-left layout")}</h3>
          <p>{t("Mirror navigation and reading direction.")}</p>
        </div>
        <MdSwitch
          name="appearanceRtl"
          aria-label={t("Right-to-left layout")}
          icons
          selected={appearance.direction === "rtl"}
          onMdChange={(event) =>
            change({ direction: event.detail.selected ? "rtl" : "ltr" })
          }
        />
      </div>
      <p className="appearance-save-status" role="status">
        {saved
          ? t("Saved on this device.")
          : t(
              "Changes apply for this session. Browser storage is unavailable.",
            )}
      </p>
      <MdButton
        slot="actions"
        variant="text"
        icon="restart_alt"
        onMdClick={() =>
          change({
            ...DEFAULT_APPEARANCE,
            direction: language === "ar" ? "rtl" : "ltr",
          })
        }
      >
        {t("Reset customization")}
      </MdButton>
      <MdButton slot="actions" variant="filled" onMdClick={onClose}>
        {t("Done")}
      </MdButton>
    </MdSideSheet>
  );
}
