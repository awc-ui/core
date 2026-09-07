import { t } from "./i18n.mjs";
import { MdChip } from "@awc-ui/react";
import { lines } from "./model.mjs";
import "./route-chips.css";

/** A compact route action: show this line without changing station selection. */
export function RouteChip({
  line,
  onSelect,
}: {
  line: string;
  onSelect: (line: string) => void;
}) {
  const route = lines.find((item) => item.id === line);
  const label = t("Show {line}", {
    line: `${line}${route ? ` ${t(route.name)}` : ""}`,
  });

  return (
    <MdChip
      className={`route-chip ${line}`}
      variant="assist"
      appearance="filled"
      density={-2}
      label={line}
      aria-label={label}
      title={label}
      onMdClick={() => onSelect(line)}
    />
  );
}
