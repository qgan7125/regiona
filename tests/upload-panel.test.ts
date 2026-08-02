import { describe, expect, it } from "vitest";

import uploadPanelSource from "../src/components/UploadPanel.tsx?raw";

describe("UploadPanel", () => {
  it("keeps the native file input hidden inside the MUI upload button", () => {
    expect(uploadPanelSource).toMatch(
      /<input\s+hidden\s+type="file"/,
    );
  });
});
