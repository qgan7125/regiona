import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import {
  clearOpenAiApiKey,
  loadOpenAiApiKey,
  saveOpenAiApiKey,
  testOpenAiApiKey,
} from "../ai/openai-key-store";

interface OpenAiSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type Notice = { severity: "success" | "error"; message: string } | undefined;

export function OpenAiSettingsDialog({
  open,
  onClose,
}: OpenAiSettingsDialogProps) {
  const [savedKey] = useState(loadOpenAiApiKey);
  const [apiKey, setApiKey] = useState(savedKey.apiKey);
  const [rememberOnDevice, setRememberOnDevice] = useState(savedKey.rememberOnDevice);
  const [isTesting, setIsTesting] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  const handleSave = () => {
    try {
      saveOpenAiApiKey(apiKey, rememberOnDevice);
      setNotice({
        severity: "success",
        message: rememberOnDevice
          ? "Key saved on this device."
          : "Key saved for this browser session.",
      });
    } catch (cause) {
      setNotice({
        severity: "error",
        message: cause instanceof Error ? cause.message : "Could not save the API key.",
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setNotice(undefined);
    try {
      await testOpenAiApiKey(apiKey);
      setNotice({ severity: "success", message: "Connection to OpenAI succeeded." });
    } catch (cause) {
      setNotice({
        severity: "error",
        message: cause instanceof Error ? cause.message : "Could not test the API key.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    clearOpenAiApiKey();
    setApiKey("");
    setRememberOnDevice(false);
    setNotice({ severity: "success", message: "Saved OpenAI key cleared from this browser." });
  };

  return (
    <Dialog
      aria-describedby="openai-settings-description"
      className="openai-settings-dialog"
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={open}
      scroll="paper"
    >
      <DialogTitle>OpenAI settings</DialogTitle>
      <DialogContent className="openai-settings-content">
        <Typography id="openai-settings-description" variant="body2">
          Regiona sends requests directly from this browser using your own OpenAI API key.
        </Typography>
        <Alert className="openai-settings-warning" severity="warning">
          Use a separate, low-budget key for this device. Never enter a shared organization key.
        </Alert>
        <TextField
          autoComplete="off"
          fullWidth
          helperText="The key is never included in Regiona project or SVG exports."
          label="OpenAI API key"
          onChange={(event) => setApiKey(event.target.value)}
          slotProps={{ htmlInput: { spellCheck: false } }}
          type="password"
          value={apiKey}
        />
        <FormControlLabel
          control={(
            <Checkbox
              checked={rememberOnDevice}
              onChange={(event) => setRememberOnDevice(event.target.checked)}
            />
          )}
          label="Remember on this device"
        />
        {notice ? (
          <Alert severity={notice.severity} role="status">
            {notice.message}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions className="openai-settings-actions">
        <Button color="inherit" onClick={handleClear} type="button">
          Clear saved key
        </Button>
        <Button disabled={isTesting} onClick={() => void handleTestConnection()} type="button">
          {isTesting ? "Testing…" : "Test connection"}
        </Button>
        <Button onClick={handleSave} type="button" variant="contained">
          Save key
        </Button>
      </DialogActions>
    </Dialog>
  );
}
