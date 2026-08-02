import Button from "@mui/material/Button";

type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";
type NavigationView = "choose" | "direct" | "workflow";

interface AppHeaderProps {
  status: WorkStatus;
  statusText: string;
  activeView: NavigationView;
  onGoHome: () => void;
  onOpenEditor: () => void;
  onOpenWorkflow: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({
  status,
  statusText,
  activeView,
  onGoHome,
  onOpenEditor,
  onOpenWorkflow,
  onOpenSettings,
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
      <nav className="primary-navigation" aria-label="Primary navigation">
        <Button
          aria-current={activeView === "direct" ? "page" : undefined}
          className="navigation-button"
          onClick={onOpenEditor}
          size="small"
          variant="text"
        >
          Editor
        </Button>
        <Button
          aria-current={activeView === "workflow" ? "page" : undefined}
          className="navigation-button"
          onClick={onOpenWorkflow}
          size="small"
          variant="text"
        >
          Workflow
        </Button>
      </nav>
      <div className="header-utility">
        <div className="status-line" role="status" aria-live="polite">
          <span className={`status-dot status-${status}`} aria-hidden="true" />
          {statusText}
        </div>
        <Button className="navigation-button" onClick={onOpenSettings} size="small" variant="text">
          AI settings
        </Button>
      </div>
    </header>
  );
}
