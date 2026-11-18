import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface ChecklistItem {
  id: string;
  label: string;
}

/**
 * A compact summary of the checked items, which opens a dialog to check or
 * uncheck each one. Used to choose the properties a curve animates and the
 * Transform effects that receive motion blur.
 */
export function ChecklistPicker<T extends ChecklistItem>({
  items,
  excluded,
  disabled,
  title,
  note,
  verb,
  empty,
  detail,
  summaryId,
  onChange,
}: {
  items: T[];
  excluded: ReadonlySet<string>;
  disabled: boolean;
  /** Dialog title; also names the summary button. */
  title: string;
  note: string;
  /** Starts the closed preview, e.g. "Animates". */
  verb: string;
  /** Preview when nothing is checked. */
  empty: string;
  /** Short extra text per item, e.g. its value range. */
  detail: (item: T) => string;
  /** Lets another control use the preview as its description. */
  summaryId?: string;
  onChange: (excluded: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const chosen = items.filter((item) => !excluded.has(item.id));
  const preview = chosen.length
    ? `${verb} ${chosen.map((item) => item.label).join(", ")}`
    : empty;

  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLElement>("input")?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function toggle(id: string) {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    // Keep keyboard focus inside the dialog while it is open.
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>("input, button"),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="property-summary"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${title}: ${chosen.length} of ${items.length}`}
        title={preview}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="property-summary-list" id={summaryId}>
          {preview}
        </span>
        <span className="property-summary-count" aria-hidden="true">
          {chosen.length}/{items.length}
        </span>
      </button>
      {open && (
        <div
          className="property-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialog}
            className="property-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={keyDown}
          >
            <h2 id={titleId}>{title}</h2>
            <p className="property-dialog-note">{note}</p>
            <ul className="property-options">
              {items.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!excluded.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="property-name">{item.label}</span>
                    <span className="property-range">{detail(item)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="property-dialog-actions">
              <button type="button" onClick={() => onChange(new Set())}>
                All
              </button>
              <button
                type="button"
                onClick={() => onChange(new Set(items.map((item) => item.id)))}
              >
                None
              </button>
              <button type="button" className="property-done" onClick={close}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
