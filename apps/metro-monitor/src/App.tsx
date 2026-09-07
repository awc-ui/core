import { useLocale } from "./useLocale";
import {
  t,
  formatNumber as fmt,
  getLocale,
  localizedMessage,
  countLabel,
} from "./i18n.mjs";
import { RouteChip } from "./RouteChip";
import { NetworkMap } from "./NetworkMap";
import { MakeItYours } from "./MakeItYours";
export { NetworkMap } from "./NetworkMap";
import { flushSync } from "react-dom";
import { registerMetroTools } from "./webmcp.mjs";
import { Auth, type User } from "./AuthScreen";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MdAppBar,
  MdAvatar,
  MdButton,
  MdCard,
  MdChip,
  MdIconButton,
  MdLineChart,
  MdMeter,
  MdNavigationRail,
  MdNavigationRailTab,
  MdSelect,
  MdSelectOption,
  MdSideSheet,
  MdSnackbar,
  MdSparkline,
  MdSwitch,
  MdTable,
  MdTableBody,
  MdTableCell,
  MdTableContainer,
  MdTableHead,
  MdTablePagination,
  MdTableRow,
  MdTableSortLabel,
  MdTextField,
  MdTooltip,
} from "@awc-ui/react";
import {
  getFlow,
  getSummary,
  incidentFixture,
  lines,
  selectStations,
  simulateSnapshot,
  stations as initialStations,
  statusLabels,
  toCSV,
  updateIncident,
} from "./model.mjs";
type Station = (typeof initialStations)[number];
type Incident = (typeof incidentFixture)[number];
export const Icon = ({ name }: { name: string }) => (
  <span aria-hidden="true" className="material-symbols-outlined">
    {name}
  </span>
);

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="train" />
      </span>
      <span>
        metro<span className="brand-light">pulse</span>
        <small>{t("Operations control")}</small>
      </span>
    </div>
  );
}
const Status = ({ status }: { status: string }) => (
  <span className={`status ${status}`}>
    <span className="status-bullet" />
    {t((statusLabels as Record<string, string>)[status] || status)}
  </span>
);
function IconAction({
  icon,
  label,
  action,
}: {
  icon: string;
  label: string;
  action: () => void;
}) {
  return (
    <MdTooltip text={label}>
      <MdIconButton
        className={
          ["logout", "menu_open", "arrow_outward", "arrow_forward"].includes(
            icon,
          )
            ? "metro-directional"
            : undefined
        }
        icon={icon}
        aria-label={label}
        onMdClick={action}
      />
    </MdTooltip>
  );
}
export function App() {
  useLocale();
  const [user, setUser] = useState<User | null>(null);
  return user ? (
    <Workspace user={user} onSignOut={() => setUser(null)} />
  ) : (
    <Auth onAuthenticated={setUser} />
  );
}
export function Workspace({
  user = { name: "Alex Morgan", email: "operator@metropulse.demo" },
  onSignOut = () => {},
}: {
  user?: { name: string; email: string };
  onSignOut?: () => void;
}) {
  const language = useLocale();
  const displayName =
    user.email === "operator@metropulse.demo" ? t("Alex Morgan") : user.name;
  const [page, setPage] = useState("overview");
  const [line, setLine] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc" | "none">("asc");
  const [tablePage, setTablePage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [rows, setRows] = useState(initialStations);
  const [incidents, setIncidents] = useState(incidentFixture);
  const [selected, setSelected] = useState<Station | null>(null);
  const [period, setPeriod] = useState("today");
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light",
  );
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const [toastKey, setToastKey] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [smallScreen, setSmallScreen] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("metro-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const compactNavigation = sidebarCollapsed && !smallScreen;
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setSmallScreen(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("metro-sidebar-collapsed", String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);
  const [incidentFilter, setIncidentFilter] = useState("active");
  const latestRows = useRef(rows);
  latestRows.current = rows;
  useEffect(() => {
    document.title = "Network overview · Metro pulse";
    return registerMetroTools(
      (document as Document & { modelContext?: unknown }).modelContext,
      {
        getStations: () => latestRows.current,
        inspect: (station: Station) => flushSync(() => setSelected(station)),
      },
    );
  }, []);
  useEffect(() => {
    if (!mobileNav) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileNav]);
  const visible = useMemo(
    () =>
      selectStations(rows, {
        query,
        line,
        status,
        sort,
        order,
        localize: t,
        locale: getLocale(),
      }),
    [rows, query, line, status, sort, order, language],
  );
  const scoped = useMemo(
    () => rows.filter((s) => line === "all" || s.lines.includes(line)),
    [rows, line],
  );
  const summary = getSummary(scoped, incidents);
  const rawFlow = getFlow(period, line);
  const flow = {
    labels: rawFlow.labels.map((label) => t(label)),
    series: rawFlow.series.map((series) => ({
      ...series,
      label: t(series.label),
    })),
  };
  const currentStation = selected
    ? rows.find((s) => s.id === selected.id) || selected
    : null;
  const notify = (message: string) => {
    setToast(message);
    setToastKey((k) => k + 1);
    setToastOpen(true);
  };
  const navigate = (value: string) => {
    document.title =
      "Metro pulse · " + value.charAt(0).toUpperCase() + value.slice(1);
    setPage(value);
    setMobileNav(false);
    setTablePage(0);
  };
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(id);
  }, [live]);
  useEffect(() => {
    if (tick) setRows(simulateSnapshot(initialStations, tick));
  }, [tick]);
  useEffect(() => {
    setTablePage(0);
  }, [query, line, status]);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("metro-theme", next);
    } catch {}
  };
  const changeIncident = (id: string, state: string) => {
    setIncidents((list) => updateIncident(list, id, state));
    notify(
      state === "resolved"
        ? "Incident resolved in this demo session."
        : "Incident acknowledged. Response team notified in simulation.",
    );
  };
  const exportCSV = () => {
    const blob = new Blob(["\uFEFF" + toCSV(visible, t)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metro-stations-simulated.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(
      t("Export complete · {stations}", {
        stations: countLabel(visible.length, "stations"),
      }),
    );
  };
  const titles: Record<string, string> = {
    overview: "Network overview",
    stations: "Stations",
    incidents: "Incident center",
    settings: "Workspace settings",
  };
  useEffect(() => {
    document.title = `${t(titles[page])} · ${t("Metro pulse")}`;
  }, [page, language]);
  const stationTable = (
    <MdTableContainer className="station-table" variant="outlined">
      <MdTable
        label={t("Metro station telemetry")}
        columnTemplate="2fr .8fr 1.2fr 1.15fr .85fr .45fr"
        minWidth="760px"
        sortBy={sort}
        sortOrder={order}
        rowOffset={tablePage * pageSize}
        rowCount={visible.length}
        keepHeight={false}
        empty={!visible.length}
        onMdSortChange={(e) => {
          setSort(e.detail.column);
          setOrder(e.detail.order);
          setTablePage(0);
        }}
      >
        <MdTableHead>
          <MdTableRow rowgroup="head">
            {[
              ["name", "Station"],
              ["lines", "Line"],
              ["status", "Status"],
              ["occupancy", "Occupancy"],
              ["passengers", "Pax / hour"],
            ].map(([id, label]) => (
              <MdTableCell key={id} head scope="col">
                <MdTableSortLabel column={id}>{t(label)}</MdTableSortLabel>
              </MdTableCell>
            ))}
            <MdTableCell head scope="col">
              {t("Details")}
            </MdTableCell>
          </MdTableRow>
        </MdTableHead>
        <MdTableBody>
          {visible
            .slice(tablePage * pageSize, (tablePage + 1) * pageSize)
            .map((s: Station) => (
              <MdTableRow key={s.id} value={s.id}>
                <MdTableCell>
                  <div className="station-name">
                    <span className="station-icon">
                      <Icon name="train" />
                    </span>
                    <span>
                      <strong>{t(s.name)}</strong>
                      <small>{s.id}</small>
                    </span>
                  </div>
                </MdTableCell>
                <MdTableCell>
                  <div className="line-badges">
                    {s.lines.map((l: string) => (
                      <RouteChip key={l} line={l} onSelect={setLine} />
                    ))}
                  </div>
                </MdTableCell>
                <MdTableCell>
                  <Status status={s.status} />
                </MdTableCell>
                <MdTableCell>
                  <div className="occupancy">
                    <MdMeter
                      locale={getLocale()}
                      value={s.occupancy}
                      max={100}
                      label={t("{station} occupancy", { station: t(s.name) })}
                      color={s.occupancy > 85 ? "warning" : "primary"}
                    />
                    <span>{fmt(s.occupancy / 100, { style: "percent" })}</span>
                  </div>
                </MdTableCell>
                <MdTableCell>{fmt(s.passengers)}</MdTableCell>
                <MdTableCell>
                  <IconAction
                    icon="arrow_outward"
                    label={t("View {station}", { station: t(s.name) })}
                    action={() => setSelected(s)}
                  />
                </MdTableCell>
              </MdTableRow>
            ))}
        </MdTableBody>
        <div slot="empty" className="empty-state">
          <Icon name="search_off" />
          <h3>{t("No stations match")}</h3>
          <p>{t("Try another station name or clear the filters.")}</p>
          <MdButton
            variant="text"
            onMdClick={() => {
              setQuery("");
              setStatus("all");
              setLine("all");
            }}
          >
            {t("Clear filters")}
          </MdButton>
        </div>
      </MdTable>
      <MdTablePagination
        slot="bottom"
        count={visible.length}
        page={tablePage}
        rowsPerPage={pageSize}
        rowsPerPageOptions="5,10,25"
        labelDisplayedRows={t("%from%–%to% of %count%")}
        labelRowsPerPage={t("Rows per page:")}
        labelFirstPage={t("First page")}
        labelPreviousPage={t("Previous page")}
        labelNextPage={t("Next page")}
        labelLastPage={t("Last page")}
        labelAll={t("All")}
        onMdPageChange={(e) => setTablePage(e.detail.page)}
        onMdRowsPerPageChange={(e) => {
          setPageSize(e.detail.rowsPerPage);
          setTablePage(0);
        }}
      />
    </MdTableContainer>
  );
  const incidentCard = (i: Incident) => (
    <article className={`incident-row ${i.severity}`} key={i.id}>
      <span className="incident-icon">
        <Icon
          name={
            i.severity === "error"
              ? "elevator"
              : i.severity === "warning"
                ? "groups"
                : "air"
          }
        />
      </span>
      <div className="incident-copy">
        <div className="incident-title">
          <strong>{t(i.title)}</strong>
          <time>{i.time}</time>
        </div>
        <p>
          {t(rows.find((s) => s.id === i.stationId)?.name)}{" "}
          <span>· {i.id}</span>
        </p>
        <div className="incident-bottom">
          <span
            className={`status ${i.state === "open" ? i.severity : "normal"}`}
          >
            {i.state === "open"
              ? t("Open")
              : i.state === "resolved"
                ? t("Resolved")
                : t("Acknowledged")}
          </span>
          <MdButton
            variant="text"
            size="xs"
            onMdClick={() =>
              setSelected(rows.find((s) => s.id === i.stationId)!)
            }
          >
            {t("View station")}
          </MdButton>
        </div>
        {page === "incidents" && (
          <>
            <p className="incident-detail">{t(i.detail)}</p>
            <div className="row-actions">
              {i.state === "open" && (
                <MdButton
                  variant="tonal"
                  size="sm"
                  onMdClick={() => changeIncident(i.id, "acknowledged")}
                >
                  {t("Acknowledge")}
                </MdButton>
              )}
              {i.state !== "resolved" && (
                <MdButton
                  variant="outlined"
                  size="sm"
                  onMdClick={() => changeIncident(i.id, "resolved")}
                >
                  {t("Resolve incident")}
                </MdButton>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
  return (
    <div className={`app-shell ${compactNavigation ? "nav-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="sidebar-heading">
          <Brand />
          <div className="sidebar-close">
            <IconAction
              icon="close"
              label={t("Close navigation")}
              action={() => setMobileNav(false)}
            />
          </div>
        </div>
        <div className="workspace-label">
          <span className="workspace-letter">C</span>
          <span>
            {t("Central metro")}
            <small>{t("Demo workspace")}</small>
          </span>
          <Icon name="unfold_more" />
        </div>
        <p className="nav-caption">{t("Workspace")}</p>
        {!smallScreen && (
          <div className="sidebar-toggle">
            <MdTooltip text={t("Toggle sidebar")}>
              <MdIconButton
                icon={compactNavigation ? "menu" : "menu_open"}
                aria-label={
                  compactNavigation
                    ? t("Expand sidebar")
                    : t("Collapse sidebar")
                }
                aria-expanded={!compactNavigation}
                aria-controls="metro-sidebar-navigation"
                onMdClick={() => setSidebarCollapsed((value) => !value)}
              />
            </MdTooltip>
          </div>
        )}
        <MdNavigationRail
          id="metro-sidebar-navigation"
          label={t("Main navigation")}
          variant="expanded"
          labelVisibility="all"
          activeIndex={[
            "overview",
            "stations",
            "incidents",
            "settings",
          ].indexOf(page)}
          onMdTabChange={(e) => navigate(e.detail.value)}
        >
          <MdNavigationRailTab
            icon="space_dashboard"
            label={t("Overview")}
            title={t("Overview")}
            value="overview"
          />
          <MdNavigationRailTab
            icon="train"
            label={t("Stations")}
            title={t("Stations")}
            value="stations"
          />
          <MdNavigationRailTab
            icon="warning"
            label={t("Incidents")}
            title={t("Incidents")}
            value="incidents"
            badgeValue={String(
              incidents.filter((i) => i.state === "open").length,
            )}
          />
          <MdNavigationRailTab
            icon="tune"
            label={t("Settings")}
            title={t("Settings")}
            value="settings"
          />
          <div slot="footer" className="sidebar-bottom">
            <div className="system-note">
              <Icon name="sensors" />
              <strong>
                {live ? t("Simulation running") : t("Simulation paused")}
              </strong>
              <p>{t("A safe space to explore metro operations.")}</p>
            </div>
            <div className="profile">
              <MdAvatar
                initials={displayName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
                label={displayName}
              />
              <div>
                <strong>{displayName}</strong>
                <small>{t("Network operator")}</small>
              </div>
              <IconAction
                icon="logout"
                label={t("Sign out")}
                action={onSignOut}
              />
            </div>
            <div className="powered">
              {t("Built with")}
              <strong>awc-ui</strong>
              <span>v1.0</span>
            </div>
          </div>
        </MdNavigationRail>
      </aside>
      <div className="workspace">
        <MdAppBar className="topbar" headline={t("Operations / Central metro")}>
          <div slot="leading" className="mobile-menu">
            <IconAction
              icon={mobileNav ? "close" : "menu"}
              label={t("Toggle navigation")}
              action={() => setMobileNav((v) => !v)}
            />
          </div>
          <div slot="trailing" className="top-actions">
            <span className="environment-badge">{t("Demo environment")}</span>
            <IconAction
              icon={theme === "light" ? "dark_mode" : "light_mode"}
              label={
                theme === "light" ? t("Use dark theme") : t("Use light theme")
              }
              action={toggleTheme}
            />
            <IconAction
              icon="notifications"
              label={t("Open incidents")}
              action={() => navigate("incidents")}
            />
            <MdTooltip text={t("Make it yours")}>
              <MdIconButton
                icon="settings"
                aria-label={t("Make it yours")}
                aria-haspopup="dialog"
                aria-expanded={appearanceOpen}
                aria-controls="metro-appearance"
                onMdClick={() => setAppearanceOpen(true)}
              />
            </MdTooltip>
            <MdAvatar
              initials={displayName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
              label={displayName}
              size="small"
            />
          </div>
        </MdAppBar>
        <MakeItYours
          open={appearanceOpen}
          onClose={() => setAppearanceOpen(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {t("Central metro")}
                <span>/</span>
                {t("Operations")}
              </div>
              <h1>{t(titles[page])}</h1>
              <p>
                {page === "overview"
                  ? t("Your network at a glance. Every station, every signal.")
                  : page === "stations"
                    ? t(
                        "Monitor station health, capacity, and passenger movement.",
                      )
                    : page === "incidents"
                      ? t(
                          "Coordinate the response and keep your network moving.",
                        )
                      : t("Make this control room work for you.")}
              </p>
            </div>
            <div className="heading-actions">
              <span className={`connection-state ${live ? "online" : ""}`}>
                <span />
                {live ? t("Updating every 15s") : t("Updates paused")}
              </span>
              <MdButton
                variant="outlined"
                icon="download"
                onMdClick={exportCSV}
              >
                {t("Export report")}
              </MdButton>
            </div>
          </div>
          {page !== "settings" && (
            <div className="network-toolbar">
              <div
                className="line-filters"
                aria-label={t("Metro line filters")}
              >
                <MdChip
                  variant="filter"
                  label={t("All lines")}
                  density={-2}
                  selected={line === "all"}
                  onMdSelect={(e) => {
                    (
                      e.currentTarget as HTMLElement & { selected: boolean }
                    ).selected = true;
                    setLine("all");
                  }}
                />
                {lines.map((l) => (
                  <MdChip
                    key={l.id}
                    className={`route-filter-chip ${l.id}`}
                    variant="filter"
                    label={`${l.id} ${t(l.name)}`}
                    density={-2}
                    selected={line === l.id}
                    onMdSelect={(e) => {
                      (
                        e.currentTarget as HTMLElement & { selected: boolean }
                      ).selected = true;
                      setLine(l.id);
                    }}
                  />
                ))}
              </div>
              <span className="snapshot-label">
                <Icon name="schedule" />
                {t("Simulated morning peak · 08:45")}
              </span>
            </div>
          )}
          {page === "overview" && (
            <>
              <section
                className="metrics"
                aria-label={t("Network performance")}
              >
                <MdCard variant="outlined" className="metric">
                  <div className="metric-label">
                    {t("Stations online")}
                    <Icon name="train" />
                  </div>
                  <div className="metric-value">
                    {fmt(summary.online)}
                    <span>/ {fmt(summary.online)}</span>
                  </div>
                  <div className="metric-foot">
                    <span className="positive">
                      <Icon name="check_circle" />
                      {t("All connected")}
                    </span>
                    <MdSparkline
                      aria-hidden="true"
                      data={[40, 40, 40, 40, 40, 40, 40]}
                      color="success"
                      style={{ height: "28px" }}
                    />
                  </div>
                </MdCard>
                <MdCard variant="outlined" className="metric">
                  <div className="metric-label">
                    {t("Passengers / hour")}
                    <Icon name="groups" />
                  </div>
                  <div className="metric-value">{fmt(summary.passengers)}</div>
                  <div className="metric-foot">
                    <span className="positive">
                      <Icon name="trending_up" />
                      {t("Morning peak")}
                    </span>
                    <MdSparkline
                      aria-hidden="true"
                      data={[30, 40, 32, 48, 42, 60, 72]}
                      color="primary"
                      style={{ height: "28px" }}
                      variant="area"
                    />
                  </div>
                </MdCard>
                <MdCard variant="outlined" className="metric">
                  <div className="metric-label">
                    {t("Average headway")}
                    <Icon name="timer" />
                  </div>
                  <div className="metric-value">
                    {fmt(Number(summary.headway), { minimumFractionDigits: 1 })}
                    <span>{t("min")}</span>
                  </div>
                  <div className="metric-foot">
                    <span className="positive">{t("Within 4 min target")}</span>
                    <MdSparkline
                      aria-hidden="true"
                      data={[4, 3.8, 4, 3.3, 3.6, 3.1, 3]}
                      color="success"
                      style={{ height: "28px" }}
                    />
                  </div>
                </MdCard>
                <MdCard variant="outlined" className="metric">
                  <div className="metric-label">
                    {t("Active incidents")}
                    <Icon name="warning" />
                  </div>
                  <div className="metric-value">
                    {fmt(summary.incidents, { minimumIntegerDigits: 2 })}
                  </div>
                  <div className="metric-foot">
                    <span className="warning-text">
                      {
                        incidents.filter(
                          (i) =>
                            i.state === "open" &&
                            scoped.some((s) => s.id === i.stationId),
                        ).length
                      }{" "}
                      {t("awaiting response")}
                    </span>
                    <MdButton
                      variant="text"
                      size="xs"
                      onMdClick={() => navigate("incidents")}
                    >
                      {t("Review")}
                    </MdButton>
                  </div>
                </MdCard>
              </section>
              <section className="overview-grid">
                <MdCard variant="outlined" className="map-card">
                  <div className="card-heading">
                    <div>
                      <h2>{t("Live network")}</h2>
                      <p>{t("Follow simulated trains or select a station.")}</p>
                    </div>
                    <span className="map-key">
                      <span className="key-dot" />
                      {t("Connected")}
                    </span>
                  </div>
                  <NetworkMap
                    rows={rows}
                    line={line}
                    onSelect={setSelected}
                    live={live}
                  />
                  <div className="map-footer">
                    <span>
                      <Icon name="route" />{" "}
                      {line === "all" ? t("3 lines") : line} <span>·</span>{" "}
                      {countLabel(scoped.length, "stations")}
                    </span>
                    <span>{t("Schematic · Demo network")}</span>
                  </div>
                </MdCard>
                <MdCard variant="outlined" className="incidents-card">
                  <div className="card-heading">
                    <h2>
                      {t("Needs attention")}{" "}
                      <span className="count-pill">
                        {fmt(summary.incidents)}
                      </span>
                    </h2>
                    <IconAction
                      icon="arrow_forward"
                      label={t("View all incidents")}
                      action={() => navigate("incidents")}
                    />
                  </div>
                  {incidents
                    .filter(
                      (i) =>
                        i.state !== "resolved" &&
                        scoped.some((s) => s.id === i.stationId),
                    )
                    .map(incidentCard)}
                  {!summary.incidents && (
                    <div className="empty-state">
                      <Icon name="task_alt" />
                      <h3>{t("All clear")}</h3>
                      <p>{t("No active incidents on this line.")}</p>
                    </div>
                  )}
                  <div className="incident-note">
                    <Icon name="info" />
                    {t("Incident actions affect this demo session.")}
                  </div>
                </MdCard>
              </section>
              <MdCard variant="outlined" className="flow-card">
                <div className="card-heading">
                  <div>
                    <h2>{t("Passenger flow")}</h2>
                    <p>
                      {t("Entries and exits across {scope}", {
                        scope: line === "all" ? t("the network") : line,
                      })}
                    </p>
                  </div>
                  <div className="period-control">
                    <MdChip
                      variant="filter"
                      label={t("Today")}
                      selected={period === "today"}
                      onMdSelect={(e) => {
                        (
                          e.currentTarget as HTMLElement & { selected: boolean }
                        ).selected = true;
                        setPeriod("today");
                      }}
                    />
                    <MdChip
                      variant="filter"
                      label={t("This week")}
                      selected={period === "week"}
                      onMdSelect={(e) => {
                        (
                          e.currentTarget as HTMLElement & { selected: boolean }
                        ).selected = true;
                        setPeriod("week");
                      }}
                    />
                  </div>
                </div>
                <MdLineChart
                  key={`${theme}-${period}-${line}-${language}`}
                  locale={getLocale()}
                  summary={t(
                    "Passenger entries and exits over the selected period.",
                  )}
                  labelEmpty={t("No data available")}
                  loadingLabel={t("Loading chart")}
                  labelPlot={t("Plot area")}
                  labelPoint={t("{label}: {value}")}
                  labelZoomStart={t("Start of visible range")}
                  labelZoomEnd={t("End of visible range")}
                  tableLabels={{
                    x: t("Time"),
                    index: t("Point"),
                    series: t("Series"),
                    truncated: t("Showing first {count} rows"),
                  }}
                  label={t("Passenger entries and exits")}
                  series={flow.series}
                  xAxis={{ data: flow.labels, scale: "category" }}
                  yAxis={{ min: 0 }}
                  style={{ height: "240px" }}
                  legend="top-end"
                  curve="smooth"
                  area
                  lineWidth={2.5}
                />
              </MdCard>
              <div className="section-heading">
                <div>
                  <h2>{t("Station watchlist")}</h2>
                  <p>{t("Latest telemetry across your selected lines")}</p>
                </div>
                <MdButton variant="text" onMdClick={() => navigate("stations")}>
                  {t("View all stations")}
                </MdButton>
              </div>
              {stationTable}
            </>
          )}
          {page === "stations" && (
            <>
              <div className="station-filters">
                <MdTextField
                  label={t("Search stations")}
                  name="stationSearch"
                  value={query}
                  variant="outlined"
                  clearable={false}
                  onMdInput={(e) => setQuery(e.detail)}
                >
                  <span
                    slot="leading-icon"
                    className="material-symbols-outlined"
                    aria-hidden="true"
                  >
                    search
                  </span>
                  <MdIconButton
                    slot="trailing-icon"
                    icon="close"
                    aria-label={t("Clear search")}
                    disabled={!query}
                    onMdClick={() => setQuery("")}
                  />
                </MdTextField>
                <MdSelect
                  label={t("Station status")}
                  name="stationStatus"
                  value={status}
                  onMdChange={(e) => setStatus(e.detail)}
                >
                  <MdSelectOption value="all" label={t("All statuses")} />
                  <MdSelectOption value="normal" label={t("Operational")} />
                  <MdSelectOption
                    value="attention"
                    label={t("Needs attention")}
                  />
                  <MdSelectOption value="busy" label={t("Busy")} />
                </MdSelect>
                <span>{countLabel(visible.length, "stations")}</span>
              </div>
              {stationTable}
            </>
          )}
          {page === "incidents" && (
            <>
              <div className="incident-filters">
                <MdChip
                  variant="filter"
                  label={t("Active")}
                  selected={incidentFilter === "active"}
                  onMdSelect={(e) => {
                    (
                      e.currentTarget as HTMLElement & { selected: boolean }
                    ).selected = true;
                    setIncidentFilter("active");
                  }}
                />
                <MdChip
                  variant="filter"
                  label={t("Resolved")}
                  selected={incidentFilter === "resolved"}
                  onMdSelect={(e) => {
                    (
                      e.currentTarget as HTMLElement & { selected: boolean }
                    ).selected = true;
                    setIncidentFilter("resolved");
                  }}
                />
              </div>
              <MdCard variant="outlined" className="incident-list">
                {incidents
                  .filter(
                    (i) =>
                      (incidentFilter === "active"
                        ? i.state !== "resolved"
                        : i.state === "resolved") &&
                      scoped.some((s) => s.id === i.stationId),
                  )
                  .map(incidentCard)}
                {!incidents.some(
                  (i) =>
                    (incidentFilter === "active"
                      ? i.state !== "resolved"
                      : i.state === "resolved") &&
                    scoped.some((s) => s.id === i.stationId),
                ) && (
                  <div className="empty-state">
                    <Icon name="task_alt" />
                    <h3>
                      {incidentFilter === "active"
                        ? t("No active incidents")
                        : t("No resolved incidents")}
                    </h3>
                    <p>
                      {incidentFilter === "active"
                        ? t("This part of the network is clear.")
                        : t("Resolved incidents will appear here.")}
                    </p>
                  </div>
                )}
              </MdCard>
            </>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <MdCard variant="outlined">
                <h2>{t("Display & telemetry")}</h2>
                <div className="setting-row">
                  <div>
                    <strong>{t("Dark appearance")}</strong>
                    <p>{t("Reduce glare in the control room.")}</p>
                  </div>
                  <MdSwitch
                    name="darkTheme"
                    aria-label={t("Dark appearance")}
                    selected={theme === "dark"}
                    onMdChange={toggleTheme}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <strong>{t("Simulated live updates")}</strong>
                    <p>{t("Refresh passenger counts every 15 seconds.")}</p>
                  </div>
                  <MdSwitch
                    name="liveUpdates"
                    aria-label={t("Simulated live updates")}
                    selected={live}
                    onMdChange={(e) => {
                      setLive(e.detail.selected);
                      notify(
                        e.detail.selected
                          ? "Simulation resumed."
                          : "Simulation paused.",
                      );
                    }}
                  />
                </div>
              </MdCard>
              <MdCard variant="outlined">
                <h2>{t("Account & access")}</h2>
                <div className="account-detail">
                  <MdAvatar
                    initials={displayName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                    label={displayName}
                  />
                  <div>
                    <strong>{displayName}</strong>
                    <p dir="ltr">{user.email}</p>
                  </div>
                </div>
                <div className="security-note">
                  <Icon name="verified_user" />
                  <div>
                    <strong>{t("Demo authentication")}</strong>
                    <p>
                      {t(
                        "Login, signup, and MFA demonstrate the interface. No real identity service is connected.",
                      )}
                    </p>
                  </div>
                </div>
                <MdButton
                  variant="outlined"
                  icon="logout"
                  onMdClick={onSignOut}
                >
                  {t("Sign out")}
                </MdButton>
              </MdCard>
            </div>
          )}
          <footer className="content-footer">
            <span>
              <Icon name="science" />
              {t("Simulated data · For demonstration")}
            </span>
            <span>
              Metro pulse <span> / </span>
              {t("Built with awc-ui")}
            </span>
          </footer>
        </main>
      </div>
      <MdSideSheet
        className="station-sheet"
        variant="modal"
        side="end"
        open={Boolean(currentStation)}
        headline={t(currentStation?.name || "Station details")}
        onMdClose={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}
      >
        <MdIconButton
          slot="close"
          icon="close"
          aria-label={t("Close details")}
          onMdClick={() => setSelected(null)}
        />
        {currentStation && (
          <div className="sheet-body">
            <div className="sheet-meta">
              <div className="line-badges">
                {currentStation.lines.map((l: string) => (
                  <RouteChip key={l} line={l} onSelect={setLine} />
                ))}
              </div>
              <Status status={currentStation.status} />
            </div>
            <p className="subtle">
              <bdi>{currentStation.id}</bdi>{" "}
              {t("· Simulated telemetry")}
            </p>
            <div className="sheet-occupancy">
              <MdMeter
                locale={getLocale()}
                variant="circular"
                size={120}
                thickness={8}
                value={currentStation.occupancy}
                label={t("Platform occupancy")}
                showValue
                valueText={fmt(currentStation.occupancy / 100, {
                  style: "percent",
                })}
                color={currentStation.occupancy > 85 ? "warning" : "primary"}
              />
              <div>
                <h3>{t("Platform occupancy")}</h3>
                <p>
                  {currentStation.occupancy > 85
                    ? t("High demand. Monitor platform access.")
                    : t("Capacity is within the operating range.")}
                </p>
              </div>
            </div>
            <div className="detail-stats">
              <div>
                <span>{t("Passengers / hour")}</span>
                <strong>{fmt(currentStation.passengers)}</strong>
              </div>
              <div>
                <span>{t("Headway")}</span>
                <strong>
                  {fmt(currentStation.headway, { minimumFractionDigits: 1 })}{" "}
                  {t("min")}
                </strong>
              </div>
              <div>
                <span>{t("Temperature")}</span>
                <strong>
                  {fmt(currentStation.temperature)} {t("°C")}
                </strong>
              </div>
              <div>
                <span>{t("Equipment available")}</span>
                <strong>
                  {fmt(currentStation.equipment / 100, { style: "percent" })}
                </strong>
              </div>
            </div>
            <h3>{t("Occupancy trend")}</h3>
            <MdSparkline
              aria-hidden="true"
              key={`${theme}-${currentStation.id}`}
              data={currentStation.trend}
              variant="area"
              color="primary"
              style={{ height: "90px" }}
            />
            <h3>{t("Station incidents")}</h3>
            {incidents
              .filter((i) => i.stationId === currentStation.id)
              .map((i) => (
                <div className="sheet-incident" key={i.id}>
                  <strong>{t(i.title)}</strong>
                  <p>{t(i.detail)}</p>
                  <span className="subtle">
                    <bdi>{i.id}</bdi> ·{" "}
                    {t(
                      i.state === "open"
                        ? "Open"
                        : i.state === "resolved"
                          ? "Resolved"
                          : "Acknowledged",
                    )}
                  </span>
                  <div className="row-actions">
                    {i.state === "open" && (
                      <MdButton
                        variant="tonal"
                        onMdClick={() => changeIncident(i.id, "acknowledged")}
                      >
                        {t("Acknowledge")}
                      </MdButton>
                    )}
                    {i.state !== "resolved" && (
                      <MdButton
                        variant="outlined"
                        onMdClick={() => changeIncident(i.id, "resolved")}
                      >
                        {t("Resolve")}
                      </MdButton>
                    )}
                  </div>
                </div>
              ))}
            {!incidents.some((i) => i.stationId === currentStation.id) && (
              <p className="positive">
                {t("No incidents reported at this station.")}
              </p>
            )}
          </div>
        )}
        <MdButton
          slot="actions"
          variant="text"
          onMdClick={() => setSelected(null)}
        >
          {t("Close details")}
        </MdButton>
      </MdSideSheet>
      <MdSnackbar
        key={toastKey}
        message={localizedMessage(toast)}
        dismissLabel={t("Dismiss")}
        open={toastOpen}
        closeable
        position="bottom-end"
        onMdClose={() => setToastOpen(false)}
      />
    </div>
  );
}
