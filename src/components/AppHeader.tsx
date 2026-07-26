type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";

interface AppHeaderProps {
  status: WorkStatus;
  statusText: string;
  canExport: boolean;
  onExportProject: () => void;
  onExportSvg: () => void;
}

export function AppHeader({
  status,
  statusText,
  canExport,
  onExportProject,
  onExportSvg,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Regiona home">
        <span aria-hidden="true">R</span>
        <span>
          <strong>Regiona</strong>
          <small>region-first reconstruction</small>
        </span>
      </a>
      <div className="status-line" role="status" aria-live="polite">
        <span className={`status-dot status-${status}`} aria-hidden="true" />
        {statusText}
      </div>
      <div className="header-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={!canExport}
          onClick={onExportProject}
        >
          Project JSON
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!canExport}
          onClick={onExportSvg}
        >
          Export editable SVG
        </button>
      </div>
    </header>
  );
}
