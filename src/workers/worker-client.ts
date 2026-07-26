import type { ReconstructionResult } from "../types/project";
import type {
  ProcessImagePayload,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";

interface PendingRequest {
  resolve: (result: ReconstructionResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number, stage: string) => void;
}

export class ReconstructionWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<string, PendingRequest>();

  constructor() {
    this.worker = new Worker(
      new URL("./reconstruction.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = () => {
      for (const request of this.pending.values()) {
        request.reject(new Error("The reconstruction worker stopped unexpectedly."));
      }
      this.pending.clear();
    };
  }

  processImage(
    payload: ProcessImagePayload,
    onProgress?: (progress: number, stage: string) => void,
  ) {
    const requestId = crypto.randomUUID();
    const request: WorkerRequest = {
      type: "PROCESS_IMAGE",
      requestId,
      payload,
    };

    return new Promise<ReconstructionResult>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject };
      if (onProgress) pending.onProgress = onProgress;
      this.pending.set(requestId, pending);
      this.worker.postMessage(request, [payload.pixels]);
    });
  }

  dispose() {
    this.worker.postMessage({ type: "DISPOSE" } satisfies WorkerRequest);
    this.worker.terminate();
    for (const request of this.pending.values()) {
      request.reject(new Error("Image processing was cancelled."));
    }
    this.pending.clear();
  }

  private handleMessage(message: WorkerResponse) {
    if (message.type === "READY") return;
    const requestId = message.requestId;
    if (!requestId) return;
    const request = this.pending.get(requestId);
    if (!request) return;

    if (message.type === "PROGRESS") {
      request.onProgress?.(message.payload.progress, message.payload.stage);
      return;
    }

    this.pending.delete(requestId);
    if (message.type === "ERROR") {
      request.reject(new Error(message.payload.message));
    } else {
      request.resolve(message.payload);
    }
  }
}
