import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import type { AiGeneratedImage } from "../ai/openai-image-provider";

interface VectorSourceConfirmationDialogProps {
  candidate?: { image: AiGeneratedImage; label: string };
  onCancel: () => void;
  onConfirm: () => void;
}

export function VectorSourceConfirmationDialog({
  candidate,
  onCancel,
  onConfirm,
}: VectorSourceConfirmationDialogProps) {
  return (
    <Dialog onClose={onCancel} open={Boolean(candidate)}>
      <DialogTitle>Use this candidate in Regiona?</DialogTitle>
      <DialogContent dividers>
        <Typography>
          {candidate?.label} will become the new source for the Regiona editor. Current regions,
          palette edits, selections, and undo history will reset because they belong to the existing image.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          Your original image and generated candidates remain available in this workflow for comparison.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="text">Cancel</Button>
        <Button autoFocus onClick={onConfirm} variant="contained">Use in Regiona vector</Button>
      </DialogActions>
    </Dialog>
  );
}
