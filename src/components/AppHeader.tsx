type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";

interface AppHeaderProps {
  status: WorkStatus;
  statusText: string;
  canExport: boolean;
  onGoHome: () => void;
  onOpenWorkflow: () => void;
  onOpenSettings: () => void;
  onExportProject: () => void;
  onExportSvg: () => void;
}

export function AppHeader({
  status,
  statusText,
  canExport,
  onGoHome,
  onOpenWorkflow,
  onOpenSettings,
  onExportProject,
  onExportSvg,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <button className="brand" type="button" onClick={onGoHome} aria-label="Return to Regiona start">
        <span aria-hidden="true">R</span>
        <span>
          <strong>Regiona</strong>
          <small>region-first reconstruction</small>
        </span>
      </button>
      <div className="status-line" role="status" aria-live="polite">
        <span className={`status-dot status-${status}`} aria-hidden="true" />
        {statusText}
      </div>
      <div className="header-actions">
        <Button
          className="secondary-button"
          onClick={onGoHome}
          variant="outlined"
          size="small"
        >
          Start
        </Button>
        <Button
          className="secondary-button"
          onClick={onOpenWorkflow}
          variant="outlined"
          size="small"
        >
          Workflow
        </Button>
        <Button
          className="secondary-button ai-settings-button"
          onClick={onOpenSettings}
          variant="outlined"
          size="small"
        >
          AI settings
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
