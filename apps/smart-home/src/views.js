import {
  rooms,
  scenes,
  statusText,
  watts,
  energy,
  escapeHtml as esc,
} from "./model.js";
import { t, n } from "./i18n.js";
export const h = (s) => esc(t(s));
export const icon = (s) =>
  `<span class="symbol" aria-hidden="true">${s}</span>`;
export const button = (label, action, glyph = "", variant = "text") =>
  `<md-button data-action="${action}" variant="${variant}" ${glyph ? `icon="${glyph}"` : ""}>${h(label)}</md-button>`;
export const nav = [
  ["home", "Home", "home"],
  ["rooms", "Rooms", "meeting_room"],
  ["scenes", "Scenes", "auto_awesome"],
  ["energy", "Energy", "bolt"],
  ["routines", "Routines", "schedule"],
];
const title = (name, copy, actions = "") =>
  `<div class="page-heading"><div><h1>${h(name)}</h1><p class="muted">${h(copy)}</p></div>${actions}</div>`;
const section = (name, action = "") =>
  `<div class="section-heading"><h2>${h(name)}</h2>${action}</div>`;
export const isActive = (d) => (d.type === "blinds" ? d.level > 0 : d.on);
export function deviceStatus(d) {
  return h(statusText(d));
}
export function deviceCard(d, detail = false) {
  const kind = {
    light: "Brightness",
    speaker: "Volume",
    fan: "Fan speed",
    blinds: "Position",
  }[d.type];
  return `<md-card class="device-card ${isActive(d) ? "device-on" : ""} ${!d.online ? "device-offline" : ""}" variant="outlined" data-device-card="${d.id}">
 <div class="row between"><span class="device-symbol">${icon(d.icon)}</span>${d.type === "blinds" ? `<md-tooltip text="${h("Device details")}"><md-icon-button icon="tune" aria-label="${h("Device details")}: ${h(d.name)}" data-action="device:${d.id}"></md-icon-button></md-tooltip>` : `<md-switch data-power="${d.id}" ${d.on ? "selected" : ""} ${!d.online ? "disabled" : ""} aria-label="${h(d.name)} ${h(d.type === "lock" ? "Locked" : "On")}"></md-switch>`}</div>
 <div class="device-title"><h3>${h(d.name)}</h3><span class="device-status" data-device-status="${d.id}"><md-status-dot inline size="small" state="${!d.online ? "neutral" : isActive(d) ? "online" : "neutral"}"></md-status-dot>${deviceStatus(d)}</span></div>
 <div class="row between small muted"><span>${h(rooms.find((r) => r.id === d.room).name)}</span>${!detail ? `<md-icon-button class="detail-button" icon="arrow_outward" aria-label="${h("Device details")}: ${h(d.name)}" data-action="device:${d.id}"></md-icon-button>` : ""}</div>
 ${kind ? `<div class="device-level"><div class="row between small"><span>${h(kind)}</span><span data-level-output="${d.id}">${n(d.level)}%</span></div><md-slider data-level="${d.id}" min="0" max="100" step="1" value="${d.level}" value-text="${n(d.level)} ${h("percent")}" size="xs" ${!d.online || (!d.on && d.type !== "blinds") ? "disabled" : ""} aria-label="${h(d.name)} — ${h(kind)}"></md-slider></div>` : `<md-divider></md-divider><p class="small muted device-note">${!d.online ? h("Connection unavailable") : d.type === "lock" ? h("Secure entry, peace of mind.") : h("Smart plug control")}</p>`}
 </md-card>`;
}
export function sceneButtons(state) {
  return `<div class="quick-scenes">${scenes.map((s) => `<md-button class="quick-scene" variant="${state.activeScene === s.id ? "filled" : "tonal"}" icon="${s.icon}" data-scene="${s.id}" aria-pressed="${state.activeScene === s.id}">${h(s.name)}</md-button>`).join("")}</div>`;
}
export function climate(state) {
  return `<md-card variant="outlined" class="panel climate-panel"><div class="row between"><h2>${h("Climate")}</h2><md-switch id="climate-power" aria-label="${h("Climate")}" ${state.climateOn ? "selected" : ""}></md-switch></div><p class="small muted">${h("Living room")} · ${h("Currently")} ${n(21.8, 1)}°C</p><div class="climate-ring"><md-meter id="temperature-ring" variant="circular" min="16" max="30" value="${state.target}" value-text="${n(state.target, 1)}°" size="184" thickness="8" label="${h("Target temperature")}" show-value></md-meter></div><div class="temperature-control"><md-icon-button icon="remove" data-action="temperature-down" aria-label="${h("Lower temperature")}" ${!state.climateOn ? "disabled" : ""}></md-icon-button><span class="small muted">${h("Target temperature")}</span><md-icon-button icon="add" data-action="temperature-up" aria-label="${h("Raise temperature")}" ${!state.climateOn ? "disabled" : ""}></md-icon-button></div><md-slider id="temperature-slider" min="16" max="30" step="0.5" value="${state.target}" value-text="${n(state.target, 1)} ${h("degrees Celsius")}" aria-label="${h("Target temperature")}" ${!state.climateOn ? "disabled" : ""}></md-slider><md-segmented-button-set id="climate-mode" aria-label="${h("Climate mode")}">${[
    ["auto", "Auto", "thermostat_auto"],
    ["heat", "Heat", "local_fire_department"],
    ["cool", "Cool", "ac_unit"],
  ]
    .map(
      ([value, label, glyph]) =>
        `<md-segmented-button value="${value}" label="${h(label)}" icon="${glyph}" ${state.climate === value ? "selected" : ""} ${!state.climateOn ? "disabled" : ""}></md-segmented-button>`,
    )
    .join("")}</md-segmented-button-set></md-card>`;
}
export function home(state) {
  return (
    title("Good evening, Alex", "Your home is just how you like it.") +
    `<div class="home-columns"><div class="home-primary"><section class="room-banner"><img src="./images/living-room.png" width="1983" height="793" alt="${h("Contemporary living room with warm lamps and a garden view")}"><div class="banner-content"><span class="banner-eyebrow">${h("Maple House")}</span><h2>${h("Living room")}</h2><p>${n(21.8, 1)}°C <span aria-hidden="true">·</span> <span data-living-on>${n(state.devices.filter((d) => d.room === "living" && d.on).length)}</span> ${h("devices on")}</p>${button("Open room", "room:living", "arrow_forward", "filled")}</div></section><section>${section("Quick scenes")}${sceneButtons(state)}</section><section>${section("Favorite devices", button("All devices", "rooms", "arrow_forward"))}<div class="device-grid">${state.devices
      .filter((d) => d.favorite)
      .map((d) => deviceCard(d))
      .join(
        "",
      )}</div></section></div><aside class="home-secondary">${climate(state)}<md-card variant="filled" class="panel energy-summary"><div class="row between"><h2>${h("Today’s energy")}</h2>${icon("bolt")}</div><div class="energy-number">${n(6.8, 1)} <span>kWh</span></div><div class="row between small"><span class="muted">${h("Current draw")}</span><strong data-watts>${n(watts(state))} W</strong></div><md-sparkline id="energy-spark" height="56px" variant="area" show-marks="none" aria-label="${h("Today’s energy")}"></md-sparkline>${button("View energy", "energy", "arrow_forward")}</md-card><md-card variant="outlined" class="panel"><h2>${h("Recent activity")}</h2><md-list class="activity-list" label="${h("Recent activity")}">${state.activity
      .slice(0, 3)
      .map(
        (a) =>
          `<md-list-item headline="${h(a.text)}" supporting-text="${esc(a.time)}" leading-icon="${a.icon}"></md-list-item>`,
      )
      .join("")}</md-list></md-card></aside></div>`
  );
}
export function roomView(state) {
  const chosen = rooms.find((r) => r.id === state.room);
  return (
    title(
      "Rooms",
      "Use the controls below or open a device for more options.",
    ) +
    `<div class="room-filters" role="group" aria-label="${h("Rooms")}"><md-chip variant="filter" label="${h("All rooms")}" data-room="all" ${state.room === "all" ? "selected" : ""}></md-chip>${rooms.map((r) => `<md-chip variant="filter" label="${h(r.name)}" icon="${r.icon}" data-room="${r.id}" ${state.room === r.id ? "selected" : ""}></md-chip>`).join("")}</div>${chosen ? `<div class="room-summary"><div>${icon(chosen.icon)}<h2>${h(chosen.name)}</h2></div><span>${n(chosen.temperature, 1)}°C <span class="muted">· ${h("Indoor conditions")}</span></span></div>` : ""}<div class="device-grid room-device-grid">${state.devices
      .filter((d) => state.room === "all" || d.room === state.room)
      .map((d) => deviceCard(d))
      .join("")}</div>`
  );
}
export function scenesView(state) {
  return (
    title("Scenes", "Set the mood in one tap.") +
    `<div class="scene-grid">${scenes.map((s) => `<md-card variant="outlined" class="scene-card"><div class="scene-icon">${icon(s.icon)}</div><h2>${h(s.name)}</h2><p class="muted">${h(s.description)}</p><div class="scene-detail">${icon("tune")}<span>${h(s.summary)}</span></div><md-button variant="${state.activeScene === s.id ? "filled" : "tonal"}" icon="play_arrow" data-scene="${s.id}">${h(state.activeScene === s.id ? "Run again" : "Run scene")}</md-button></md-card>`).join("")}</div><md-card class="scene-explanation" variant="filled">${icon("auto_awesome")}<div><h2>${h("One tap, a different atmosphere")}</h2><p>${h("Each scene updates the lights, climate, and devices together. You can still adjust any device afterwards.")}</p></div></md-card>`
  );
}
export function energyView(state) {
  const total = energy[state.period].data.reduce((a, b) => a + b, 0);
  return (
    title("Energy", "A clearer view of your home’s energy.") +
    `<div class="energy-metrics">${[
      [
        "bolt",
        state.period === "week" ? "Weekly total" : "Today’s energy",
        n(total, 1) + " kWh",
        "Simulated readings",
      ],
      [
        "electric_meter",
        "Current draw",
        n(watts(state)) + " W",
        "Connected devices + climate",
      ],
      ["payments", "Estimated cost", "€" + n(total * 0.28, 2), "€0.28 per kWh"],
    ]
      .map(
        ([glyph, label, value, copy]) =>
          `<md-card variant="outlined" class="metric-card"><div class="row between muted"><span>${h(label)}</span>${icon(glyph)}</div><strong>${value}</strong><span class="small muted">${h(copy)}</span></md-card>`,
      )
      .join(
        "",
      )}</div><div class="energy-layout"><md-card variant="outlined" class="panel"><div class="section-heading"><div><h2>${h("Usage history")}</h2><p class="small muted">${h("Simulated readings")} · kWh</p></div><md-segmented-button-set id="energy-period" aria-label="${h("Usage history")}"><md-segmented-button value="day" label="${h("Today")}" ${state.period === "day" ? "selected" : ""}></md-segmented-button><md-segmented-button value="week" label="${h("This week")}" ${state.period === "week" ? "selected" : ""}></md-segmented-button></md-segmented-button-set></div><md-bar-chart id="energy-chart" height="300px" legend="none" label="${h("Energy use")}" category-gap="45%" corner-radius="6"></md-bar-chart></md-card><md-card variant="outlined" class="panel"><h2>${h("By room")}</h2><p class="small muted">${h("Today’s energy")}</p>${[
      ["living", 3.1],
      ["kitchen", 1.8],
      ["office", 1.2],
      ["bedroom", 0.5],
      ["entry", 0.2],
    ]
      .map(
        ([id, v]) =>
          `<div class="room-energy"><div class="row between"><span>${h(rooms.find((r) => r.id === id).name)}</span><strong>${n(v, 1)} kWh</strong></div><md-meter min="0" max="6.8" value="${v}" label="${h(rooms.find((r) => r.id === id).name)}" value-text="${v} kWh"></md-meter></div>`,
      )
      .join("")}</md-card></div>`
  );
}
export function routineView(state) {
  return (
    title(
      "Routines",
      "Make everyday moments automatic.",
      button("New routine", "new-routine", "add", "filled"),
    ) +
    `<md-card variant="filled" class="routine-intro">${icon("schedule")}<div><h2>${h("Preview schedules and try their scenes.")}</h2><p>${h("Schedules are a demo; use Run now to try them.")}</p></div></md-card><div class="routine-list">${state.routines
      .map((r) => {
        const s = scenes.find((s) => s.id === r.scene);
        return `<md-card variant="outlined" class="routine-card"><span class="routine-symbol">${icon(s.icon)}</span><div class="routine-copy"><h2>${h(r.name)}</h2><p class="muted"><bdi>${esc(r.time)}</bdi> · ${h(r.days)} · ${h(s.name)}</p></div><md-button variant="text" icon="play_arrow" data-run-routine="${r.id}">${h("Run now")}</md-button><md-switch data-routine="${r.id}" aria-label="${h(r.name)} ${h("Enabled")}" ${r.enabled ? "selected" : ""}></md-switch></md-card>`;
      })
      .join("")}</div>`
  );
}
export function routineDialog() {
  return `<md-dialog id="routine-dialog" headline="${h("New routine")}" icon="schedule"><form id="routine-form" class="form-stack"><md-text-field name="name" label="${h("Routine name")}" max-length="60" required variant="outlined"></md-text-field><md-time-picker name="time" label="${h("Time")}" value="07:00" format="24h" variant="input" responsive required
    headline-input-label="${h("Enter time")}" headline-dial-label="${h("Select time")}"
    hour-label="${h("Hour")}" minute-label="${h("Minute")}" period-label="${h("Period")}" am-label="${h("AM")}" pm-label="${h("PM")}"
    cancel-label="${h("Cancel")}" ok-label="${h("OK")}" toggle-dial-label="${h("Toggle dial picker")}" toggle-input-label="${h("Toggle keyboard input")}"
    value-missing-label="${h("Please select a time.")}" range-underflow-label="${h("Please select a time at or after {min}.")}" range-overflow-label="${h("Please select a time at or before {max}.")}" range-outside-label="${h("Please select a time at or after {min} or at or before {max}.")}"></md-time-picker><md-select name="days" label="${h("Schedule")}" value="Every day"><md-select-option value="Every day" label="${h("Every day")}"></md-select-option><md-select-option value="Weekdays" label="${h("Weekdays")}"></md-select-option></md-select><md-select name="scene" label="${h("Scene")}" value="home">${scenes.map((s) => `<md-select-option value="${s.id}" label="${h(s.name)}"></md-select-option>`).join("")}</md-select><p id="routine-error" role="alert" class="error"></p><md-button type="submit" variant="filled" full-width>${h("Save routine")}</md-button></form><md-button slot="actions" data-action="close-dialog" variant="text">${h("Cancel")}</md-button></md-dialog>`;
}
export function deviceSheet(d) {
  return `<md-side-sheet id="device-sheet" headline="${h(d.name)}" variant="modal" top-divider bottom-divider closeable><div class="sheet-content">${deviceCard(d, true)}<md-list label="${h("Device details")}"><md-list-item headline="${h("Connection")}" supporting-text="${h(d.online ? "Connected" : "Offline")}" leading-icon="${d.online ? "wifi" : "wifi_off"}"></md-list-item><md-list-item headline="${h("Room")}" supporting-text="${h(rooms.find((r) => r.id === d.room).name)}" leading-icon="meeting_room"></md-list-item></md-list><md-button data-action="favorite:${d.id}" variant="tonal" icon="${d.favorite ? "star" : "star_border"}" full-width>${h(d.favorite ? "Remove from favorites" : "Add to favorites")}</md-button><p class="small muted">${h("No physical devices are connected.")}</p></div><md-button slot="actions" variant="filled" data-action="close-device">${h("Done")}</md-button></md-side-sheet>`;
}
