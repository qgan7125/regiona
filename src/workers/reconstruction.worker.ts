/// <reference lib="webworker" />

import { reconstructImage } from "../engine/reconstruct";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function respond(message: WorkerResponse, transfer: Transferable[] = []) {
  workerScope.postMessage(message, transfer);
}

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === "INITIALIZE") {
    respond({ type: "READY" });
    return;
  }

  if (request.type === "DISPOSE") {
    workerScope.close();
    return;
  }

  try {
    respond({
      type: "PROGRESS",
      requestId: request.requestId,
      payload: { progress: 0.18, stage: "Reducing the palette" },
    });
    const result = reconstructImage({
      ...request.payload,
      pixels: new Uint8ClampedArray(request.payload.pixels),
    });
    respond(
      {
        type: "PROCESSING_COMPLETE",
        requestId: request.requestId,
        payload: result,
      },
      [result.labelMap.buffer, result.quantizedPixels.buffer],
    );
  } catch (error) {
    respond({
      type: "ERROR",
      requestId: request.requestId,
      payload: {
        message:
          error instanceof Error ? error.message : "Image processing failed.",
      },
    });
  }
};

