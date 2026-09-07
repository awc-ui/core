import {
  analysts,
  analystLoad,
  assayTypes,
  compounds,
  escapeHtml as esc,
  getAnalyst,
  getCompound,
  getRun,
  priorities,
} from "./model.js";

const number = (value) => new Intl.NumberFormat("en-US").format(value);
const date = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
const field = (name, label, extra = "") =>
  `<md-text-field variant="outlined" name="${esc(name)}" label="${esc(label)}" reserve-supporting-space ${extra}></md-text-field>`;
const select = (name, label, options, value = "", extra = "") =>
  `<md-select variant="outlined" full-width name="${esc(name)}" label="${esc(label)}" value="${esc(value)}" reserve-supporting-space max-height="280" ${extra}>${options
    .map(
      (option) =>
        `<md-select-option value="${esc(option.value)}" label="${esc(option.label)}"${option.supportingText ? ` supporting-text="${esc(option.supportingText)}"` : ""}${option.disabled ? " disabled" : ""}></md-select-option>`,
    )
    .join("")}</md-select>`;

function analystOptions(state, currentId) {
  return [
    {
      value: "",
      label: "Unassigned",
      supportingText: "Assign an analyst before starting.",
    },
    ...analysts.map((person) => {
      const load = analystLoad(state, person.id);
      const unavailable =
        person.status !== "Available" ||
        (load >= person.capacity && person.id !== currentId);
      return {
        value: person.id,
        label: person.name,
        supportingText: `${person.specialty} · ${load}/${person.capacity} runs · ${person.status}`,
        disabled: unavailable,
      };
    }),
  ];
}

// Status chips supply the library's visual treatment; the named wrapper exposes
// the read-only information without putting an inert action in the tab order.
function statusChip(label, color = "secondary", prefix = "") {
  return `<span class="detail-status" role="img" aria-label="${esc(prefix ? `${prefix}: ${label}` : label)}"><md-chip variant="assist" appearance="filled" color="${color}" label="${esc(label)}" inert aria-hidden="true"></md-chip></span>`;
}
const statusColor = (status) =>
  ({
    Draft: "secondary",
    Queued: "info",
    Running: "primary",
    Review: "warning",
    Completed: "success",
  })[status] || "secondary";
const priorityColor = (priority) =>
  ({ Urgent: "error", High: "warning", Normal: "secondary" })[priority] ||
  "secondary";
const errorMarkup = () => '<p class="form-error" role="alert"></p>';
const closeAction =
  '<md-button slot="actions" variant="text" data-action="close-overlay">Close</md-button>';
const fact = (label, value) =>
  `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

export function newRunView(state) {
  return `<form id="new-run-form" class="overlay-form"><md-dialog id="workspace-overlay" class="new-run-dialog" headline="Create a test run" icon="biotech" divider>
    <p class="overlay-intro">Bring a sample batch into your testing workflow. New runs start as drafts, ready for your team to review.</p>
    <div class="form-grid">
      <div class="form-span">${field("title", "Test run title", 'max-length="120" supporting-text="Optional. A title is generated from the compound and assay."')}</div>
      ${select(
        "compoundId",
        "Compound candidate",
        compounds.map((compound) => ({
          value: compound.id,
          label: `${compound.name} · ${compound.code}`,
          supportingText: compound.program,
        })),
        "",
        'required value-missing-label="Choose a compound candidate."',
      )}
      ${select(
        "assayType",
        "Assay type",
        assayTypes.map((assay) => ({ value: assay, label: assay })),
        "",
        'required value-missing-label="Choose an assay type."',
      )}
      ${field("batchId", "Batch reference", 'max-length="60" supporting-text="Optional. A batch reference is generated if empty."')}
      <md-number-field name="sampleCount" label="Sample count" variant="outlined" min="1" max="1000" step="1" small-step="1" value="24" required reserve-supporting-space supporting-text="1 to 1,000 whole samples." value-missing-label="Enter the number of samples." increment-label="Add one sample" decrement-label="Remove one sample"></md-number-field>
      ${select(
        "priority",
        "Priority",
        [...priorities]
          .reverse()
          .map((priority) => ({ value: priority, label: priority })),
        "Normal",
        "required",
      )}
      ${select("analystId", "Assigned analyst", analystOptions(state), "")}
      <div class="form-span">${field("description", "Notes", 'multiline="auto-grow" rows="2" max-length="1000" supporting-text="Optional context for your research team."')}</div>
    </div>
    <p class="overlay-intro">Due in two days by default. This creates a simulated laboratory record.</p>
    ${errorMarkup()}
    <md-button slot="actions" variant="text" data-action="close-overlay">Cancel</md-button>
    <md-button slot="actions" variant="filled" type="submit">Create test run</md-button>
  </md-dialog></form>`;
}

function sampleSummary(run) {
  return `<section class="detail-section"><h3>Sample overview</h3>
    <dl class="detail-metrics">${fact("Passed", number(run.passedSamples))}${fact("Flagged", number(run.flaggedSamples))}${fact("Pending", number(run.pendingSamples))}</dl>
    <md-progress-indicator value="${run.progress}" max="100" label="Test run completion"></md-progress-indicator>
    <p class="detail-caption">${number(run.progress)}% assessed · ${number(run.sampleCount)} samples in this batch</p>
    <p class="detail-caption">Illustrative results for this component showcase.</p>
  </section>`;
}

function reviewMarkup(run) {
  if (run.status === "Review")
    return `<section class="detail-section"><h3>Review the results</h3>
    <p>${run.flaggedSamples > 0 ? `${number(run.flaggedSamples)} flagged ${run.flaggedSamples === 1 ? "sample needs" : "samples need"} your review. Record the reason for your decision.` : "Review the sample results and add a note for your team."}</p>
    <form id="review-form" class="overlay-form" data-id="${esc(run.id)}">
      ${field("note", "Review note", 'multiline="auto-grow" rows="3" required max-length="2000" supporting-text="Explain your decision for the research record."')}
      ${errorMarkup()}
      <div class="form-actions"><md-button variant="filled" type="submit" data-action="approve-run" data-id="${esc(run.id)}">Approve results</md-button><md-button variant="outlined" type="submit" data-action="retest-run" data-id="${esc(run.id)}">Request retest</md-button></div>
    </form>
  </section>`;
  if (run.review)
    return `<section class="detail-section"><h3>Latest review</h3><md-card variant="filled" class="detail-note"><strong>${run.review.decision === "approve" ? "Results approved" : "Retest requested"}</strong><p>${esc(run.review.note || "Results reviewed and recorded.")}</p><small>${esc(run.review.reviewer)} · ${esc(date(run.review.at))} UTC</small></md-card></section>`;
  return "";
}

function notesMarkup(run) {
  return `<section class="detail-section"><h3>Research notes</h3>
    ${
      run.notes.length
        ? `<md-list label="Research notes">${[...run.notes]
            .reverse()
            .map(
              (note) =>
                `<md-list-item type="text" expandable headline="${esc(note.author)}" overline="${esc(date(note.at))} UTC" supporting-text="${esc(note.text.length > 90 ? `${note.text.slice(0, 87)}…` : note.text)}" lines="3"><p slot="expanded-content" class="detail-note-text">${esc(note.text)}</p></md-list-item>`,
            )
            .join("")}</md-list>`
        : '<p class="detail-caption">No notes yet. Add context for the next person.</p>'
    }
    ${run.status !== "Completed" ? `<form id="note-form" class="overlay-form" data-id="${esc(run.id)}">${field("note", "Add a note", 'required multiline="auto-grow" rows="2" max-length="2000"')} ${errorMarkup()}<div class="form-actions"><md-button variant="outlined" type="submit" icon="add_comment">Add note</md-button></div></form>` : '<p class="detail-caption">This completed record is read-only.</p>'}
  </section>`;
}

export function runDetailView(state, id) {
  const run = getRun(state, id);
  if (!run)
    return `<md-side-sheet id="workspace-overlay" class="detail-sheet" variant="modal" headline="Test run unavailable" top-divider><p>This test run could not be found.</p>${closeAction}</md-side-sheet>`;
  const compound = getCompound(run.compoundId);
  const analyst = getAnalyst(run.analystId);
  const canAssign = ["Draft", "Queued"].includes(run.status);
  const nextAction = {
    Draft: "Queue test run",
    Queued: "Start test run",
    Running: "Send to review",
  }[run.status];
  return `<md-side-sheet id="workspace-overlay" class="detail-sheet" variant="modal" headline="${esc(run.id)}" top-divider bottom-divider>
    <div class="detail-content">
      <div class="detail-kicker">${esc(compound?.program || "Research program")}</div>
      <h2>${esc(run.title)}</h2>
      <div class="detail-chips">${statusChip(run.status, statusColor(run.status), "Status")}${statusChip(run.priority, priorityColor(run.priority), "Priority")}</div>
      <p>${esc(run.description || "No additional description has been recorded.")}</p>
      <dl class="detail-facts">${fact("Compound", `${compound?.name || run.compoundId} · ${run.compoundId}`)}${fact("Assay", run.assayType)}${fact("Batch", run.batchId)}${fact("Location", run.location)}${fact("Due", `${date(run.dueAt)} UTC`)}${fact("Analyst", analyst?.name || "Unassigned")}</dl>
      ${sampleSummary(run)}
      ${canAssign ? `<section class="detail-section"><h3>Analyst assignment</h3><form id="assign-form" class="overlay-form" data-id="${esc(run.id)}">${select("analystId", "Assigned analyst", analystOptions(state, run.analystId), run.analystId || "")} ${errorMarkup()}<div class="form-actions"><md-button variant="outlined" type="submit" icon="person_add">Save assignment</md-button></div></form></section>` : ""}
      ${run.status === "Queued" && !analyst ? '<p class="detail-caption">Assign an analyst before starting this test run.</p>' : ""}
      ${reviewMarkup(run)}
      ${notesMarkup(run)}
      <section class="detail-section"><h3>Activity</h3><md-list label="Test run activity">${[
        ...run.timeline,
      ]
        .reverse()
        .map(
          (event) =>
            `<md-list-item type="text" headline="${esc(event.title)}" overline="${esc(date(event.at))} UTC" supporting-text="${esc(event.detail)}" leading-icon="history" lines="3"></md-list-item>`,
        )
        .join("")}</md-list></section>
    </div>
    ${closeAction}${nextAction ? `<md-button slot="actions" variant="filled" data-action="advance-run" data-id="${esc(run.id)}">${nextAction}</md-button>` : ""}
  </md-side-sheet>`;
}

export function compoundDetailView(state, id) {
  const compound = getCompound(id);
  if (!compound)
    return `<md-side-sheet id="workspace-overlay" class="detail-sheet" variant="modal" headline="Compound unavailable"><p>This compound could not be found.</p>${closeAction}</md-side-sheet>`;
  const runs = state.runs.filter((run) => run.compoundId === id);
  const owner = getAnalyst(compound.ownerId);
  return `<md-side-sheet id="workspace-overlay" class="detail-sheet" variant="modal" headline="${esc(compound.name)}" top-divider bottom-divider>
    <div class="detail-content"><div class="detail-kicker">${esc(compound.code)} · ${esc(compound.program)}</div><h2>${esc(compound.name)}</h2><p>${esc(compound.summary)}</p>
      <dl class="detail-facts">${fact("Research stage", compound.stage)}${fact("Sample type", compound.form)}${fact("Program owner", owner?.name || "Unassigned")}${fact("Test runs", number(runs.length))}</dl>
      <section class="detail-section"><h3>Testing record</h3><dl class="detail-metrics">${fact("Active", number(runs.filter((run) => run.status !== "Completed").length))}${fact("Completed", number(runs.filter((run) => run.status === "Completed").length))}${fact("Samples", number(runs.reduce((sum, run) => sum + run.sampleCount, 0)))}</dl></section>
      <section class="detail-section"><h3>Associated test runs</h3>${runs.length ? `<md-list label="Test runs for ${esc(compound.name)}">${runs.map((run) => `<md-list-item type="button" headline="${esc(run.id)} · ${esc(run.assayType)}" supporting-text="${esc(run.status)} · ${number(run.sampleCount)} samples · ${esc(run.priority)} priority" leading-icon="science" lines="2" data-action="open-run" data-id="${esc(run.id)}"></md-list-item>`).join("")}</md-list>` : '<p class="detail-caption">No test runs have been created for this candidate.</p>'}</section>
      <p class="detail-caption">Fictional compound candidate. This workspace does not provide laboratory methods or medical guidance.</p>
    </div>${closeAction}
  </md-side-sheet>`;
}

export function settingsView(prefs) {
  return `<md-side-sheet id="workspace-overlay" class="settings-sheet" variant="modal" headline="Make it yours" top-divider bottom-divider>
    <div class="detail-content"><p class="overlay-intro">A workspace that feels like yours. Changes apply instantly and stay in this browser.</p>
      <section class="settings-section"><h3>Primary color</h3><p class="detail-caption">Choose a color to generate a coordinated light and dark palette.</p><md-color-picker id="primary-color" variant="inline" value="${esc(prefs.primary)}" format="hex" aria-label="Workspace primary color" presets="#75516f,#52659c,#386a59,#936143,#6b5ea8" show-inputs="false"></md-color-picker></section>
      <section class="settings-section"><h3>Display</h3>
        <md-select id="density" name="density" label="Content density" value="${esc(String(prefs.density))}" variant="outlined" full-width><md-select-option value="0" label="Comfortable"></md-select-option><md-select-option value="-1" label="Compact"></md-select-option><md-select-option value="-2" label="Dense"></md-select-option></md-select>
        <label class="settings-row"><span class="settings-copy"><strong>Dark mode</strong><span>A softer setting for evening work.</span></span><md-switch id="dark-mode" name="darkMode" aria-label="Dark mode" ${prefs.theme === "dark" ? "selected" : ""}></md-switch></label>
        <label class="settings-row"><span class="settings-copy"><strong>Right-to-left layout</strong><span>Mirror the workspace direction.</span></span><md-switch id="rtl-mode" name="rtlMode" aria-label="Right-to-left layout" ${prefs.rtl ? "selected" : ""}></md-switch></label>
      </section>
    </div><md-button slot="actions" variant="text" data-action="reset-preferences">Reset preferences</md-button><md-button slot="actions" variant="filled" data-action="close-overlay">Done</md-button>
  </md-side-sheet>`;
}

export function accountView(session) {
  return `<md-side-sheet id="workspace-overlay" class="detail-sheet account-sheet" variant="modal" headline="Your account" top-divider bottom-divider>
    <div class="detail-content">
      <div class="detail-chips">${statusChip("MFA verified", "success")}${statusChip("Demo session", "secondary")}</div>
      <dl class="detail-facts">${fact("Name", session.name)}${fact("Email", session.email)}${fact("Role", session.role)}</dl>
      <p class="detail-caption">You completed the sample verification flow. Authentication is simulated; no identity service is connected.</p>
      <p class="detail-caption">Signing out clears this tab’s demo session.</p>
    </div>
    ${closeAction}<md-button slot="actions" variant="filled" icon="logout" data-action="sign-out">Sign out</md-button>
  </md-side-sheet>`;
}
