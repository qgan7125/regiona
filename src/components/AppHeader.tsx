type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";

interface AppHeaderProps {
  status: WorkStatus;
  statusText: string;
  canExport: boolean;
  canUndo: boolean;
  onUndoColor: () => void;
  onExportProject: () => void;
  onExportSvg: () => void;
}

export function AppHeader({
  status,
  statusText,
  canExport,
  canUndo,
  onUndoColor,
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
        <Button
          className="secondary-button undo-button"
          disabled={!canUndo}
          onClick={onUndoColor}
          aria-label="Undo last region color change"
          variant="outlined"
          size="small"
        >
          Undo color
        </Button>
        <Button
          className="secondary-button"
          disabled={!canExport}
          onClick={onExportProject}
          variant="outlined"
          size="small"
        >
          Project JSON
        </Button>
        <Button
          className="primary-button"
          disabled={!canExport}
          onClick={onExportSvg}
          variant="contained"
          size="small"
        >
          Export editable SVG
        </Button>
      </div>
    </header>
  );
}
import Button from "@mui/material/Button";
