import { t, formatNumber as fmt, countLabel } from "./i18n.mjs";
import { useEffect, useId, useRef, useState } from "react";
import {
  MdButton,
  MdChip,
  MdSegmentedButton,
  MdSegmentedButtonSet,
} from "@awc-ui/react";
import { stations, statusLabels } from "./model.mjs";
import {
  advanceSimulationTime,
  movementRoutes,
  simulatedTrains,
  trainAtTime,
} from "./metro-movement.mjs";
import "./network-movement.css";
type Station = (typeof stations)[number];
export function NetworkMap({
  rows,
  line,
  onSelect,
  compact = false,
  live = true,
}: {
  rows: Station[];
  line: string;
  onSelect?: (s: Station) => void;
  compact?: boolean;
  live?: boolean;
}) {
  const [playing, setPlaying] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [visible, setVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [selectedId, setSelectedId] = useState("M1-A");
  const clock = useRef(0);
  const statusId = useId();
  const running = !compact && live && playing && visible;

  useEffect(() => {
    if (compact) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motion.matches) setPlaying(false);
    };
    const onVisibilityChange = () =>
      setVisible(document.visibilityState !== "hidden");
    motion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      motion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [compact]);

  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    let lastPaint = previous;
    let frame = 0;
    const advance = (now: number) => {
      // A suspended/busy tab never produces a jump across the route.
      clock.current = advanceSimulationTime(
        clock.current,
        Math.min(now - previous, 100),
        speed,
        true,
      );
      previous = now;
      if (now - lastPaint >= 1000 / 30) {
        setElapsed(clock.current);
        lastPaint = now;
      }
      frame = window.requestAnimationFrame(advance);
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [running, speed]);

  const trains = simulatedTrains
    .filter((train) => line === "all" || train.line === line)
    .map((train) => ({
      ...train,
      state: trainAtTime(
        movementRoutes.find((route) => route.id === train.line)!,
        elapsed,
        train.offset,
      ),
    }));
  const selectedTrain =
    trains.find((train) => train.id === selectedId) || trains[0];
  const compactPaths = [
    ["M1", "M82 230 H672"],
    ["M2", "M330 42 V285 Q330 325 370 325 H500"],
    [
      "M3",
      "M82 58 H220 Q245 58 265 80 L302 117 Q330 144 357 117 L395 80 Q418 58 440 58 H672",
    ],
  ];
  const paths = compact
    ? compactPaths
    : movementRoutes.map((route) => [route.id, route.path]);
  return (
    <div className={`network-map ${compact ? "compact" : "with-trains"}`}>
      {!compact && (
        <div className="network-playback">
          <div className="network-playback-label">
            <strong>{t("Simulated train movement")}</strong>
            <small>
              {countLabel(trains.length, "trains")} ·{" "}
              {!live
                ? t("Network paused")
                : running
                  ? t("Running")
                  : t("Paused")}
            </small>
          </div>
          <div className="network-playback-actions">
            <MdButton
              variant="tonal"
              size="xs"
              icon={playing ? "pause" : "play_arrow"}
              disabled={!live}
              aria-label={playing ? t("Pause trains") : t("Play trains")}
              onMdClick={() => setPlaying((value) => !value)}
            >
              {playing ? t("Pause") : t("Play")}
            </MdButton>
            <MdSegmentedButtonSet
              density={-2}
              aria-label={t("Simulation speed")}
              onMdChange={(event) => {
                const next = Number(event.detail[0]);
                if ([1, 2, 4].includes(next)) setSpeed(next);
              }}
            >
              {[1, 2, 4].map((value) => (
                <MdSegmentedButton
                  key={value}
                  value={String(value)}
                  label={`${fmt(value)}×`}
                  aria-label={t("{speed} times simulation speed", {
                    speed: fmt(value),
                  })}
                  selected={speed === value}
                  noCheckmark
                />
              ))}
            </MdSegmentedButtonSet>
          </div>
        </div>
      )}
      <svg
        viewBox="0 0 750 385"
        aria-label={t("Schematic of the simulated metro network")}
        role="group"
      >
        <defs>
          <pattern
            id={compact ? "dots-small" : "dots"}
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="1"
              cy="1"
              r="1"
              fill="var(--md-sys-color-outline-variant)"
              opacity=".45"
            />
          </pattern>
        </defs>
        <rect
          width="750"
          height="385"
          fill={`url(#${compact ? "dots-small" : "dots"})`}
        />
        <path d="M0 293 Q155 255 255 285 T500 280 T750 318" className="river" />
        <text x="85" y="311" className="river-label">
          {t("River Alder")}
        </text>
        {paths.map(([id, d], i) => (
          <path
            key={id}
            d={d}
            stroke={`var(--metro-line-${i + 1})`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={line === "all" || line === id ? 1 : 0.12}
          />
        ))}
        {rows.map((s) => (
          <g
            key={s.id}
            className={`map-stop ${onSelect ? "interactive" : ""}`}
            opacity={line === "all" || s.lines.includes(line) ? 1 : 0.23}
            role={onSelect ? "button" : undefined}
            tabIndex={
              onSelect && (line === "all" || s.lines.includes(line))
                ? 0
                : undefined
            }
            aria-label={t("{station}, {status}, {occupancy}% occupancy", {
              station: t(s.name),
              status: t(statusLabels[s.status as keyof typeof statusLabels]),
              occupancy: fmt(s.occupancy),
            })}
            onClick={() => onSelect?.(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(s);
              }
            }}
          >
            {s.status !== "normal" && (
              <circle
                className="station-halo"
                cx={s.x}
                cy={s.y}
                r="17"
                fill={
                  s.status === "busy"
                    ? "var(--md-sys-color-warning)"
                    : "var(--md-sys-color-error)"
                }
                opacity=".13"
              />
            )}
            <circle
              className="station-node"
              cx={s.x}
              cy={s.y}
              r={s.lines.length > 1 ? 9 : 6}
              fill="var(--md-sys-color-surface)"
              stroke="var(--md-sys-color-on-surface)"
              strokeWidth={s.lines.length > 1 ? 3 : 2}
            />
            <text
              x={s.x}
              y={
                s.y +
                (s.id === "ST08"
                  ? 34
                  : s.y === 230
                    ? 30
                    : s.y === 325
                      ? 32
                      : -21)
              }
              textAnchor="middle"
              className={s.lines.length > 1 ? "interchange-label" : ""}
            >
              {t(s.name)}
            </text>
            {s.status !== "normal" && (
              <circle
                className="station-status-dot"
                cx={s.x + 13}
                cy={s.y - 13}
                r="4.5"
                fill={
                  s.status === "busy"
                    ? "var(--md-sys-color-warning)"
                    : "var(--md-sys-color-error)"
                }
              />
            )}
          </g>
        ))}
        {!compact &&
          trains.map((train) => (
            <g
              key={train.id}
              className="train-marker"
              transform={`translate(${train.state.x} ${train.state.y})`}
              aria-hidden="true"
            >
              {selectedTrain?.id === train.id && (
                <rect
                  className="train-marker-selection"
                  x="-15"
                  y="-12"
                  width="30"
                  height="24"
                  rx="8"
                />
              )}
              <path
                className="train-direction"
                d="M17 -3 L22 0 L17 3 Z"
                transform={`rotate(${train.state.angle + (train.state.direction === -1 ? 180 : 0)})`}
              />
              <rect
                className="train-marker-body"
                x="-12"
                y="-9"
                width="24"
                height="18"
                rx="5"
                fill={`var(--metro-line-${train.line.slice(1)})`}
              />
              <text className="train-marker-label" x="0" y="0">
                {train.label}
              </text>
            </g>
          ))}
      </svg>
      {!compact && selectedTrain && (
        <div
          className="network-train-selection"
          role="group"
          aria-label={t("Inspect a simulated train")}
        >
          {trains.map((train) => (
            <MdChip
              key={train.id}
              variant="assist"
              label={train.id}
              selectable
              selected={train.id === selectedTrain.id}
              density={-2}
              aria-describedby={
                train.id === selectedTrain.id ? statusId : undefined
              }
              onMdSelect={(event) => {
                // Keep exactly one train selected, including a repeat click.
                (
                  event.currentTarget as HTMLElement & { selected: boolean }
                ).selected = true;
                setSelectedId(train.id);
              }}
            />
          ))}
          <p className="network-train-status" id={statusId} aria-live="off">
            <strong>{selectedTrain.id}</strong>
            {" · "}
            {selectedTrain.state.dwelling
              ? t("At {station}", {
                  station: t(selectedTrain.state.current.name),
                })
              : t("From {station}", {
                  station: t(selectedTrain.state.current.name),
                })}{" "}
            {t("→")} {t(selectedTrain.state.next.name)}
            <br />
            {selectedTrain.state.dwelling ? t("Boarding") : t("In transit")}
            {" · "}
            {t("Toward {station}", {
              station: t(selectedTrain.state.destination.name),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
