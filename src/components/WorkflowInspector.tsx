import { type ChangeEvent, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AiGeneratedImage } from "../ai/openai-image-provider";
import type { AiStructureAnalysis } from "../ai/structure-analysis";
import type { WorkflowNodeId } from "./WorkflowCanvas";
import { WorkflowImageComparison } from "./WorkflowImageComparison";
import { copyPromptText } from "./prompt-copy";

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
  colorizedLineArt?: AiGeneratedImage;
  colorCount: number;
  runningStage?: "analysis" | "redraw" | "line-art" | "color";
  error?: string;
  onClose: () => void;
  onFile: (file: File) => void;
  onRunAnalyze: () => void;
  onRunCleanRedraw: () => void;
  onRunLineArt: () => void;
  onRunColorizeLineArt: () => void;
  onColorCountChange: (colorCount: number) => void;
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
    description: "Reverse-engineer a prompt from visible details, then summarize practical Regiona reconstruction advice.",
  },
  "clean-redraw": {
    title: "AI clean redraw",
    description: "Create a cleaner image candidate while preserving the source composition.",
  },
  "black-line-art": {
    title: "Black line art",
    description: "Create a black-on-white line-art candidate that can feed Regiona vector directly.",
  },
  "colorize-line-art": {
    title: "Colorize line art",
    description: "Use the original as a color reference while preserving black line art as the geometry reference.",
  },
  "regiona-vector": {
    title: "Regiona vector",
    description: "Open the deterministic Regiona editor with the original or an explicitly adopted candidate.",
  },
};

interface PromptCardProps {
  label: string;
  value: string;
  copied: boolean;
  copyUnavailable: boolean;
  onCopy: () => void;
}

function PromptCard({ label, value, copied, copyUnavailable, onCopy }: PromptCardProps) {
  return (
    <Box className="workflow-prompt-card">
      <div className="workflow-prompt-card__header">
        <Typography color="text.secondary" variant="overline">{label}</Typography>
        <Button aria-label={`Copy ${label}`} onClick={onCopy} size="small" variant="text">
          {copied ? "Copied" : copyUnavailable ? "Copy unavailable" : "Copy"}
        </Button>
      </div>
      <Typography className="workflow-prompt-card__content" variant="body2">{value}</Typography>
    </Box>
  );
}

export function WorkflowInspector({
  nodeId,
  source,
  analysis,
  cleanRedraw,
  lineArt,
  colorizedLineArt,
  colorCount,
  runningStage,
  error,
  onClose,
  onFile,
  onRunAnalyze,
  onRunCleanRedraw,
  onRunLineArt,
  onRunColorizeLineArt,
  onColorCountChange,
  onUseInRegionaVector,
  onOpenEditor,
}: WorkflowInspectorProps) {
  const [copiedPrompt, setCopiedPrompt] = useState<string>();
  const [copyUnavailable, setCopyUnavailable] = useState(false);

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

  const handleCopyPrompt = async (label: string, value: string) => {
    const copied = await copyPromptText(
      value,
      navigator.clipboard?.writeText.bind(navigator.clipboard),
    );
    setCopyUnavailable(!copied);
    setCopiedPrompt(copied ? label : undefined);
  };

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
                <Stack className="workflow-analysis" spacing={1.5}>
                  <PromptCard
                    copied={copiedPrompt === "Recreation prompt"}
                    copyUnavailable={copyUnavailable}
                    label="Recreation prompt"
                    onCopy={() => void handleCopyPrompt("Recreation prompt", analysis.recreationPrompt)}
                    value={analysis.recreationPrompt}
                  />
                  <PromptCard
                    copied={copiedPrompt === "Core prompt"}
                    copyUnavailable={copyUnavailable}
                    label="Core prompt"
                    onCopy={() => void handleCopyPrompt("Core prompt", analysis.corePrompt)}
                    value={analysis.corePrompt}
                  />
                  <PromptCard
                    copied={copiedPrompt === "Negative prompt"}
                    copyUnavailable={copyUnavailable}
                    label="Negative prompt"
                    onCopy={() => void handleCopyPrompt("Negative prompt", analysis.negativePrompt)}
                    value={analysis.negativePrompt}
                  />
                  <Box className="workflow-analysis-card">
                    <Typography color="text.secondary" variant="overline">Style tags</Typography>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                      {analysis.styleTags.map((tag) => <Chip key={tag} label={tag} size="small" />)}
                    </Stack>
                  </Box>
                  <Box className="workflow-analysis-card">
                    <Typography color="text.secondary" variant="overline">Analysis</Typography>
                    <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                      {analysis.analysis.map((sentence, index) => <li key={`${index}-${sentence}`}><Typography variant="body2">{sentence}</Typography></li>)}
                    </Box>
                  </Box>
                  <Box className="workflow-analysis-card">
                    <Typography color="text.secondary" variant="body2">{analysis.variantOffer}</Typography>
                  </Box>
                  <Box className="workflow-analysis-card">
                    <Typography variant="subtitle2">Regiona reconstruction advice</Typography>
                    <Typography color="text.secondary" variant="body2">{analysis.summary}</Typography>
                    <Typography color="text.secondary" variant="body2">{analysis.subjectDescription}</Typography>
                  </Box>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    <Chip label={`${analysis.imageKind} image`} size="small" />
                    <Chip label={`${analysis.suggestedColorCount} suggested colors`} size="small" />
                    <Chip label={`${analysis.reconstructionStrategy} strategy`} size="small" />
                  </Stack>
                  {analysis.detectedProblems.length ? (
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {analysis.detectedProblems.map((problem) => <li key={problem}><Typography variant="body2">{problem}</Typography></li>)}
                    </Box>
                  ) : <Typography color="text.secondary" variant="body2">No high-confidence Regiona issues reported.</Typography>}
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

          {nodeId === "colorize-line-art" ? (
            comparisonOriginal ? (
              <>
                {!lineArt ? <Typography color="text.secondary" variant="body2">Generate black line art first. The black-and-white line art is the working image; your uploaded source remains the color reference.</Typography> : null}
                <Box className="workflow-analysis-card">
                  <Typography variant="subtitle2">Color count</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Use {colorCount} flat fill colors. Black linework and the white background remain unchanged.
                  </Typography>
                  <Slider
                    aria-label="Line-art color count"
                    disabled={!lineArt || isRunning}
                    max={32}
                    min={2}
                    onChange={(_event, value) => onColorCountChange(Number(value))}
                    value={colorCount}
                    valueLabelDisplay="auto"
                  />
                </Box>
                <WorkflowImageComparison
                  onUseInRegionaVector={onUseInRegionaVector}
                  original={comparisonOriginal}
                  output={colorizedLineArt}
                  outputLabel="Colorized line art"
                  primaryAction={
                    <Button disabled={!lineArt || isRunning} onClick={onRunColorizeLineArt} size="small" variant="contained">
                      {runningStage === "color" ? "Colorizing..." : colorizedLineArt ? `Recolorize with ${colorCount} colors` : `Colorize with ${colorCount} colors`}
                    </Button>
                  }
                />
              </>
            ) : (
              <Button disabled={!lineArt || isRunning} onClick={onRunColorizeLineArt} variant="contained">Colorize with {colorCount} colors</Button>
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
