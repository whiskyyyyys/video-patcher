"use strict";

importScripts("mp4-patcher.js");

self.onmessage = async ({ data }) => {
  if (data.type !== "process") return;
  try {
    const result = await self.WhisMP4.process(data.file, (value, label, detail) => {
      self.postMessage({ type: "progress", value, label, detail });
    });
    self.postMessage({ type: "done", blob: result.blob, report: result.report });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Unknown error while applying the patch.",
      details: error?.details || error?.stack || ""
    });
  }
};
