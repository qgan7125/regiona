import { type ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AiGeneratedImage } from "../ai/openai-image-provider";
import type { AiStructureAnalysis } from "../ai/structure-analysis";
import type { WorkflowNodeId } from "./WorkflowCanvas";
import { WorkflowImageComparison } from "./WorkflowImageComparison";

interface WorkflowSourceSummary {
  filename: string;
  url: string;
  originalWidth: number;
  originalHeight: number;
  mimeType: string;
}

interface WorkflowInspectorProps {
  nodeId?: WorkflowNodeId;
  source?: WorkflowSourceSummary;
  analysis?: AiStructureAnalysis;
  cleanRedraw?: AiGeneratedImage;
  lineArt?: AiGeneratedImage;
  colorReconstruction?: AiGeneratedImage;
  runningStage?: "analysis" | "redraw" | "line-art" | "color";
  error?: string;
  onClose: () => void;
  onFile: (file: File) => void;
  onRunAnalyze: () => void;
  onRunCleanRedraw: () => void;
  onRunLineArt: () => void;
  onRunColorReconstruction: () => void;
  onUseInRegionaVector: (image: AiGeneratedImage, label: string) => void;
  onOpenEditor: () => void;
}

const details: Record<WorkflowNodeId, { title: string; description: string }> = {
  start: {
    title: "Start",
    description: "The original image stays available as the reference for every workflow branch.",
  },
  analyze: {
    title: "Analyze",
    description: "Ask Gemini for a review of the visible structure and likely vectorization risks.",
  },
  "clean-redraw": {
    title: "AI clean redraw",
    description: "Create a cleaner image candidate while preserving the source composition.",
  },
  "black-line-art": {
    title: "Black line art",
    description: "Create a black-on-white line-art candidate that can feed Regiona vector directly.",
  },
  "apply-source-colors": {
    title: "Apply source colors",
    description: "Restore source colors onto the clean-redraw geometry as a separate candidate.",
  },
  "regiona-vector": {
    title: "Regiona vector",
    description: "Open the deterministic Regiona editor with the original or an explicitly adopted candidate.",
  },
};

export function WorkflowInspector({
  nodeId,
  source,
  analysis,
  cleanRedraw,
  lineArt,
  colorReconstruction,
  runningStage,
  error,
  onClose,
  onFile,
  onRunAnalyze,
  onRunCleanRedraw,
  onRunLineArt,
  onRunColorReconstruction,
  onUseInRegionaVector,
  onOpenEditor,
}: WorkflowInspectorProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  const detail = nodeId ? details[nodeId] : undefined;
  const hasSource = Boolean(source);
  const isRunning = Boolean(runningStage);
  const comparisonOriginal = source ? {
    url: source.url,
    filename: source.filename,
    width: source.originalWidth,
    height: source.originalHeight,
    mimeType: source.mimeType,
  } : undefined;

  return (
    <Dialog className="workflow-inspector-dialog" fullWidth maxWidth="xl" onClose={onClose} open={Boolean(nodeId)} scroll="paper">
      <DialogTitle component="div">
        <Typography color="text.secondary" sx={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Workflow node
        </Typography>
        <Typography component="h2" variant="h5">{detail?.title}</Typography>
        <Typography className="workflow-inspector__description" color="text.secondary" variant="body2">
          {detail?.description}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack className="workflow-inspector" spacing={2}>
          {nodeId === "start" ? (
            <Stack spacing={1.5}>
              {source ? (
                <>
                  <Box component="img" alt="Original source preview" src={source.url} sx={{ width: "100%", maxHeight: 300, objectFit: "contain", bgcolor: "#f4f5f2" }} />
                  <Typography variant="body2">{source.filename} · {source.originalWidth} x {source.originalHeight} · {source.mimeType.replace("image/", "").toUpperCase()}</Typography>
                </>
              ) : <Typography color="text.secondary">Upload a PNG, JPEG, or WebP to begin this workflow.</Typography>}
              <Button component="label" variant="contained">
                {source ? "Replace source image" : "Upload source image"}
                <input accept="image/png,image/jpeg,image/webp" hidden onChange={handleFileChange} type="file" />
              </Button>
            </Stack>
          ) : null}

          {nodeId === "analyze" ? (
            <Stack spacing={1.5}>
              <Button disabled={!hasSource || isRunning} onClick={onRunAnalyze} variant="contained">
                {runningStage === "analysis" ? "Analyzing..." : analysis ? "Analyze again" : "Analyze image"}
              </Button>
              {analysis ? (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{analysis.summary}</Typography>
                  <Typography color="text.secondary" variant="body2">{analysis.subjectDescription}</Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    <Chip label={`${analysis.imageKind} image`} size="small" />
                    <Chip label={`${analysis.suggestedColorCount} suggested colors`} size="small" />
                    <Chip label={`${analysis.reconstructionStrategy} strategy`} size="small" />
                  </Stack>
                  {analysis.detectedProblems.length ? (
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {analysis.detectedProblems.map((problem) => <li key={problem}><Typography variant="body2">{problem}</Typography></li>)}
                    </Box>
                  ) : <Typography color="text.secondary" variant="body2">No high-confidence issues reported.</Typography>}
                </Stack>
              ) : null}
            </Stack>
          ) : null}

          {nodeId === "clean-redraw" ? (
            comparisonOriginal ? (
              <WorkflowImageComparison
                onUseInRegionaVector={onUseInRegionaVector}
                original={comparisonOriginal}
                output={cleanRedraw}
                outputLabel="Clean redraw"
                primaryAction={
                  <Button disabled={!hasSource || isRunning} onClick={onRunCleanRedraw} size="small" variant="contained">
                    {runningStage === "redraw" ? "Generating..." : cleanRedraw ? "Regenerate clean redraw" : "Generate clean redraw"}
                  </Button>
                }
              />
            ) : (
              <Button disabled={!hasSource || isRunning} onClick={onRunCleanRedraw} variant="contained">Generate clean redraw</Button>
            )
          ) : null}

          {nodeId === "black-line-art" ? (
            comparisonOriginal ? (
              <WorkflowImageComparison
                onUseInRegionaVector={onUseInRegionaVector}
                original={comparisonOriginal}
                output={lineArt}
                outputLabel="Black line art"
                primaryAction={
                  <Button disabled={!hasSource || isRunning} onClick={onRunLineArt} size="small" variant="contained">
                    {runningStage === "line-art" ? "Generating..." : lineArt ? "Regenerate black line art" : "Generate black line art"}
                  </Button>
                }
              />
            ) : (
              <Button disabled={!hasSource || isRunning} onClick={onRunLineArt} variant="contained">Generate black line art</Button>
            )
          ) : null}

          {nodeId === "apply-source-colors" ? (
            comparisonOriginal ? (
              <>
                {!cleanRedraw ? <Typography color="text.secondary" variant="body2">Generate a clean redraw first; this node combines it with the original source.</Typography> : null}
                <WorkflowImageComparison
                  onUseInRegionaVector={onUseInRegionaVector}
                  original={comparisonOriginal}
                  output={colorReconstruction}
                  outputLabel="Color reconstruction"
                  primaryAction={
                    <Button disabled={!cleanRedraw || isRunning} onClick={onRunColorReconstruction} size="small" variant="contained">
                      {runningStage === "color" ? "Applying colors..." : colorReconstruction ? "Reapply source colors" : "Apply source colors"}
                    </Button>
                  }
                />
              </>
            ) : (
              <Button disabled={!cleanRedraw || isRunning} onClick={onRunColorReconstruction} variant="contained">Apply source colors</Button>
            )
          ) : null}

          {nodeId === "regiona-vector" ? (
            <Stack spacing={1.5}>
              <Button disabled={!hasSource} onClick={onOpenEditor} variant="contained">Open Regiona editor</Button>
              <Typography color="text.secondary" variant="body2">The original is the current vector source. You can explicitly adopt an AI candidate from its comparison view.</Typography>
            </Stack>
          ) : null}

          {error && nodeId !== "start" ? <Typography color="error" role="alert" variant="body2">{error}</Typography> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
