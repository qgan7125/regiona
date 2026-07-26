import type { ReconstructionResult } from "../types/project";

export interface ProcessImagePayload {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  targetColors: number;
  tinyRegionMaximumArea: number;
  sourceFilename: string;
}

export type WorkerRequest =
  | { type: "INITIALIZE" }
  | {
      type: "PROCESS_IMAGE";
      requestId: string;
      payload: ProcessImagePayload;
    }
  | { type: "DISPOSE" };

export type WorkerResponse =
  | { type: "READY" }
  | {
      type: "PROGRESS";
      requestId: string;
      payload: { progress: number; stage: string };
    }
  | {
      type: "PROCESSING_COMPLETE";
      requestId: string;
      payload: ReconstructionResult;
    }
  | {
      type: "ERROR";
      requestId?: string;
      payload: { message: string };
    };
