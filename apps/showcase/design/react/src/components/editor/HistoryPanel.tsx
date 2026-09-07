import { useT as usePictorT } from '@/lib/showcase';
import { editIcon } from '@awc-ui/showcase-kit/design';
import { useDocument } from '@/lib/document';
import { useT } from '@/lib/showcase';

export function HistoryPanel() {
  const p = usePictorT();
  const t = useT(); const doc = useDocument();
  const { entries, index } = doc.history;
  return <div className="history studio-history" data-history><div className="studio-panel-head"><strong>{p("Time machine")}</strong><span>{p("{count} edits", { count: entries.length })}</span></div><p className="studio-tip">{p("Revisit any step. Making a new edit replaces the redo branch.")}</p><button className="history__row" data-current={index === 0 ? '' : undefined} onClick={() => doc.jumpHistory(0)}><span className="material-symbols-outlined" aria-hidden="true">flag</span><span><strong>{p("Starting canvas")}</strong><small>{p("Your document before these edits")}</small></span>{index === 0 ? <span className="studio-history__current">{p("Current")}</span> : null}</button>{entries.map((entry, i) => <button key={entry.id} className="history__row" data-edit={entry.kind} data-undone={i >= index ? '' : undefined} data-current={i === index - 1 ? '' : undefined} onClick={() => doc.jumpHistory(i + 1)}><span className="material-symbols-outlined" aria-hidden="true">{editIcon(entry.kind)}</span><span><strong>{t(entry.labelKey)}</strong><small>{entry.after[0]?.name ?? entry.before[0]?.name ?? p("Canvas")}{Math.max(entry.before.length, entry.after.length) > 1 ? p(" + {value} more", { value: Math.max(entry.before.length, entry.after.length) - 1 }) : ''}</small></span>{i === index - 1 ? <span className="studio-history__current">{p("Current")}</span> : <span className="studio-history__number">{i + 1}</span>}</button>)}{entries.length === 0 ? <div className="studio-history-empty"><span className="material-symbols-outlined" aria-hidden="true">history</span><p>{p("Your next idea starts here. Every change is reversible.")}</p></div> : null}</div>;
}
