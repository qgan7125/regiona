import { type ChangeEvent, useState } from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import { describeUpscaleCandidate } from "../ai/image-scale";
import type { AiGeneratedImage } from "../ai/openai-image-provider";
import type { AiStructureAnalysis } from "../ai/structure-analysis";
import type { WorkflowNodeId } from "./WorkflowCanvas";
import { WorkflowImageComparison } from "./WorkflowImageComparison";
import { buildCompletePrompt, copyPromptText } from "./prompt-copy";

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
  imageScale?: AiGeneratedImage;
  imageScaleFactor: number;
  cleanRedraw?: AiGeneratedImage;
  lineArt?: AiGeneratedImage;
  colorizedLineArt?: AiGeneratedImage;
  colorCount: number;
  runningStage?: "analysis" | "scale" | "redraw" | "line-art" | "color";
  error?: string;
  onClose: () => void;
  onFile: (file: File) => void;
  onRunAnalyze: () => void;
  onRunImageScale: () => void;
  onImageScaleFactorChange: (scale: number) => void;
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
    description: "Reconstruct a prompt from visible details for high-fidelity image regeneration.",
  },
  "image-scale": {
    title: "AI upscale",
    description: "Create a high-resolution candidate while preserving the source composition and details.",
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
}

function PromptCard({ label, value }: PromptCardProps) {
  return (
    <Box className="workflow-prompt-card">
      <div className="workflow-prompt-card__header">
        <Typography color="text.secondary" variant="overline">{label}</Typography>
      </div>
      <Typography className="workflow-prompt-card__content" variant="body2">{value}</Typography>
    </Box>
  );
}

export function WorkflowInspector({
  nodeId,
  source,
  analysis,
  imageScale,
  imageScaleFactor,
  cleanRedraw,
  lineArt,
  colorizedLineArt,
  colorCount,
  runningStage,
  error,
  onClose,
  onFile,
  onRunAnalyze,
  onRunImageScale,
  onImageScaleFactorChange,
  onRunCleanRedraw,
  onRunLineArt,
  onRunColorizeLineArt,
  onColorCountChange,
  onUseInRegionaVector,
  onOpenEditor,
}: WorkflowInspectorProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copyUnavailable, setCopyUnavailable] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  const detail = nodeId
    ? nodeId === "image-scale"
      ? {
        ...details[nodeId],
        description: `Create a ${describeUpscaleCandidate(imageScaleFactor)} while preserving the source composition and details.`,
      }
      : details[nodeId]
    : undefined;
  const hasSource = Boolean(source);
  const isRunning = Boolean(runningStage);
  const comparisonOriginal = source ? {
    url: source.url,
    filename: source.filename,
    width: source.originalWidth,
    height: source.originalHeight,
    mimeType: source.mimeType,
  } : undefined;

  const handleCopyPrompt = async (value: string) => {
    const copied = await copyPromptText(
      value,
      navigator.clipboard?.writeText.bind(navigator.clipboard),
    );
    setCopyUnavailable(!copied);
    setCopiedPrompt(copied);
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
              <Button
                disabled={!hasSource || isRunning}
                onClick={() => {
                  setCopiedPrompt(false);
                  setCopyUnavailable(false);
                  onRunAnalyze();
                }}
                variant="contained"
              >
                {runningStage === "analysis" ? "Analyzing..." : analysis ? "Analyze again" : "Analyze image"}
              </Button>
              {analysis ? (
                <Stack className="workflow-analysis" spacing={1.5}>
                  <Button
                    onClick={() => void handleCopyPrompt(buildCompletePrompt(analysis))}
                    variant="outlined"
                  >
                    {copiedPrompt ? "Copied full prompt" : copyUnavailable ? "Copy unavailable" : "Copy full prompt"}
                  </Button>
                  <PromptCard
                    label="Recreation prompt"
                    value={analysis.recreationPrompt}
                  />
                  <PromptCard
                    label="Core prompt"
                    value={analysis.corePrompt}
                  />
                  <PromptCard
                    label="Negative prompt"
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
                </Stack>
              ) : null}
            </Stack>
          ) : null}

          {nodeId === "image-scale" ? (
            comparisonOriginal ? (
              <WorkflowImageComparison
                onUseInRegionaVector={onUseInRegionaVector}
                original={comparisonOriginal}
                output={imageScale}
                outputLabel={`AI upscale ${imageScaleFactor}×`}
                toolbarControl={
                  <>
                    <span>Output scale</span>
                    <ToggleButtonGroup
                      aria-label="AI upscale factor"
                      disabled={isRunning}
                      exclusive
                      onChange={(_event, scale: number | null) => {
                        if (scale) onImageScaleFactorChange(scale);
                      }}
                      size="small"
                      value={imageScaleFactor}
                    >
                      <ToggleButton value={2}>2×</ToggleButton>
                      <ToggleButton value={3}>3×</ToggleButton>
                      <ToggleButton value={4}>4×</ToggleButton>
                    </ToggleButtonGroup>
                  </>
                }
                primaryAction={
                  <Button disabled={!hasSource || isRunning} onClick={onRunImageScale} size="small" variant="contained">
                    {runningStage === "scale" ? "Upscaling..." : imageScale ? `Regenerate ${imageScaleFactor}× upscale` : `Create ${imageScaleFactor}× upscale`}
                  </Button>
                }
              />
            ) : (
              <Button disabled={!hasSource || isRunning} onClick={onRunImageScale} variant="contained">Create {imageScaleFactor}× upscale</Button>
            )
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
                {!lineArt ? (
                  <Alert className="workflow-inline-notification" severity="info" variant="outlined">
                    Generate black line art first. It becomes the black-and-white working image; your upload stays available only as the color reference.
                  </Alert>
                ) : null}
                <WorkflowImageComparison
                  onUseInRegionaVector={onUseInRegionaVector}
                  original={comparisonOriginal}
                  referenceOptions={[
                    { id: "source", label: "Source reference", ...comparisonOriginal },
                    ...(lineArt ? [{
                      id: "line-art",
                      label: "Black line art",
                      url: lineArt.dataUrl,
                      filename: "black-line-art",
                      width: comparisonOriginal.width,
                      height: comparisonOriginal.height,
                      mimeType: lineArt.mimeType,
                    }] : []),
                  ]}
                  output={colorizedLineArt}
                  outputLabel="Colorized line art"
                  toolbarControl={
                    <>
                      <span>Fill colors</span>
                      <Slider
                        aria-label="Line-art color count"
                        disabled={!lineArt || isRunning}
                        max={32}
                        min={2}
                        onChange={(_event, value) => onColorCountChange(Number(value))}
                        value={colorCount}
                        valueLabelDisplay="auto"
                      />
                    </>
                  }
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
