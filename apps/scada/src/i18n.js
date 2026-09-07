import { ar } from "./ar.js";
import { arAuth } from "./ar-auth.js";
import { assets, initialAlarms } from "./model.js";

const dictionary = { ...arAuth, ...ar };
const activeLanguage = () =>
  globalThis.document?.documentElement?.lang === "ar" ? "ar" : "en";
export function t(text, language = activeLanguage()) {
  if (language !== "ar" || typeof text !== "string") return text;
  if (Object.hasOwn(dictionary, text)) return dictionary[text];
  const stages = /^Stage (\d+)$/.exec(text);
  if (stages)
    return (
      "المرحلة " + new Intl.NumberFormat("ar-EG").format(Number(stages[1]))
    );
  const critical = /^(\d+) critical · review required$/.exec(text);
  if (critical)
    return (
      new Intl.NumberFormat("ar-EG").format(Number(critical[1])) +
      " إنذار حرج · يلزم المراجعة"
    );
  if (text.startsWith("Demo verification complete. Welcome, "))
    return (
      "اكتمل التحقق التجريبي. مرحباً، " +
      text.slice("Demo verification complete. Welcome, ".length)
    );
  return text;
}
for (const a of assets) {
  dictionary[`${a.id} · ${a.name}`] = `${a.id} · ${t(a.name, "ar")}`;
  dictionary[`${a.name} health`] = `سلامة ${t(a.name, "ar")}`;
  dictionary[`Inspect ${a.id}`] = `عرض تفاصيل ${a.id}`;
  dictionary[`Inspect ${a.name}`] = `عرض تفاصيل ${t(a.name, "ar")}`;
  dictionary[`Inspect ${a.name} (${a.id}), ${a.area}, ${a.status}`] =
    `عرض تفاصيل ${t(a.name, "ar")} (${a.id})، ${t(a.area, "ar")}، ${t(a.status, "ar")}`;
}
for (const a of initialAlarms) {
  dictionary[`Acknowledge ${a.asset} alarm`] = `الإقرار بإنذار ${a.asset}`;
  dictionary[`Acknowledge ${a.asset} alarm?`] =
    `هل تريد الإقرار بإنذار ${a.asset}؟`;
  dictionary[`Acknowledge ${a.title} on ${a.asset}`] =
    `الإقرار بإنذار ${t(a.title, "ar")} للمعدة ${a.asset}`;
  dictionary[`· ${a.detail}`] = `· ${t(a.detail, "ar")}`;
  dictionary[
    `${a.detail}. Acknowledgment records your review in this demo. The equipment condition remains unchanged.`
  ] =
    `${t(a.detail, "ar")}. يسجّل الإقرار مراجعتك في هذا العرض التجريبي، وتبقى حالة المعدة دون تغيير.`;
}
const nodes = new WeakMap();
const attributes = new WeakMap();
const labels = [
  "label",
  "loading-label",
  "headline",
  "supporting-text",
  "aria-label",
  "text",
  "summary",
  "placeholder",
  "incomplete-label",
  "toggle-label",
  "expand-label",
  "value-text",
  "overline",
];
function translatedRecord(current, previous, language) {
  const source = previous?.translated === current ? previous.source : current;
  const trimmed = source.trim();
  return { source, translated: source.replace(trimmed, t(trimmed, language)) };
}
// Translate only presentation content, never control values, IDs, routes or user input.
// Remember original strings so language changes preserve mounted controls and focus.
export function localize(root, language = activeLanguage()) {
  function visit(node) {
    if (node.nodeType === 3) {
      const record = translatedRecord(
        node.nodeValue,
        nodes.get(node),
        language,
      );
      nodes.set(node, record);
      if (node.nodeValue !== record.translated)
        node.nodeValue = record.translated;
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11)
      return;
    if (node.nodeType === 1) {
      if (node.matches('script,style,code,.icon,[translate="no"]')) return;
      const saved = attributes.get(node) || new Map();
      for (const name of labels) {
        if (!node.hasAttribute(name)) continue;
        const record = translatedRecord(
          node.getAttribute(name),
          saved.get(name),
          language,
        );
        saved.set(name, record);
        if (node.getAttribute(name) !== record.translated)
          node.setAttribute(name, record.translated);
      }
      attributes.set(node, saved);
      if (
        ["md-dialog", "md-color-picker", "md-line-chart", "md-meter"].includes(
          node.localName,
        )
      )
        node.setAttribute("locale", language);
      localizeComponent(node, language);
    }
    for (const child of [...node.childNodes]) visit(child);
  }
  visit(root);
}
function localizeComponent(node, language) {
  const ar = language === "ar";
  if (node.localName === "md-side-sheet") {
    let close = node.querySelector('[slot="close"]');
    if (!close) {
      close = node.ownerDocument.createElement("md-icon-button");
      close.setAttribute("slot", "close");
      close.setAttribute("icon", "close");
      close.addEventListener("mdClick", () => node.close());
      node.appendChild(close);
    }
    close.setAttribute("aria-label", ar ? "إغلاق" : "Close");
  }
  const props = {
    "md-checkbox": {
      "value-missing-label": ar
        ? "حدّد مربع الاختيار هذا للمتابعة."
        : "Please check this box if you want to proceed.",
    },
    "md-snackbar": { "dismiss-label": ar ? "إغلاق" : "Close" },
    "md-line-chart": {
      "label-empty": ar ? "لا توجد بيانات للعرض" : "No data to display",
      "loading-label": ar ? "جارٍ تحميل المخطط…" : "Loading chart…",
      "label-zoom-start": ar ? "بداية نطاق العرض" : "Start of visible range",
      "label-zoom-end": ar ? "نهاية نطاق العرض" : "End of visible range",
    },
    "md-table-pagination": {
      "label-rows-per-page": ar ? "صفوف لكل صفحة" : "Rows per page",
      "label-displayed-rows": ar
        ? "%from%–%to% من %count%"
        : "%from%–%to% of %count%",
      "label-first-page": ar ? "الصفحة الأولى" : "First page",
      "label-previous-page": ar ? "الصفحة السابقة" : "Previous page",
      "label-next-page": ar ? "الصفحة التالية" : "Next page",
      "label-last-page": ar ? "الصفحة الأخيرة" : "Last page",
      "label-all": ar ? "الكل" : "All",
    },
    "md-select": {
      "search-placeholder": ar ? "بحث…" : "Search…",
      "filter-label": ar ? "تصفية الخيارات" : "Filter options",
      "no-results-text": ar ? "لا توجد نتائج" : "No results",
      "no-options-text": ar ? "لا توجد خيارات" : "No options",
      "clear-label": ar ? "مسح الاختيار" : "Clear selection",
      "searching-label": ar ? "جارٍ البحث" : "Searching",
      "loading-text": ar ? "جارٍ التحميل…" : "Loading…",
      "value-missing-label": ar
        ? "يرجى اختيار عنصر."
        : "Please select an item.",
    },
    "md-otp-field": {
      "cell-label-template": ar
        ? "الخانة {index} من {length}"
        : "Character {index} of {length}",
      "value-missing-label": ar
        ? "أدخل رمز التحقق كاملاً."
        : "Enter the complete verification code.",
    },
    "md-stepper": {
      "step-word": ar ? "الخطوة" : "Step",
      "of-word": ar ? "من" : "of",
      "completed-word": ar ? "مكتملة" : "completed",
      "current-word": ar ? "الحالية" : "current",
    },
  }[node.localName];
  if (props)
    for (const [name, value] of Object.entries(props))
      if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
