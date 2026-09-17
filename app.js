(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ui = {
    dropzone: $("dropzone"), fileInput: $("fileInput"), browse: $("browseButton"),
    processor: $("processor"), fileName: $("fileName"), fileMeta: $("fileMeta"),
    replace: $("replaceButton"), status: $("statusLabel"), detail: $("statusDetail"),
    progress: $("progressBar"), glow: $("progressGlow"), percent: $("progressValue"),
    result: $("resultGrid"), patchCount: $("patchCount"), outputSize: $("outputSize"),
    sizeDelta: $("sizeDelta"), error: $("errorCard"), errorMessage: $("errorMessage"),
    export: $("exportButton"), details: $("detailsButton"), panel: $("detailsPanel"),
    closeDetails: $("closeDetails"), audit: $("auditGrid"), log: $("log"), sound: $("soundToggle"),
    previewContainer: $("previewContainer"), videoPreview: $("videoPreview"),
    videoResolution: $("videoResolution"),
    stepFtyp: $("stepFtyp"), stepMoov: $("stepMoov"), stepMdat: $("stepMdat"),
    copyLogButton: $("copyLogButton"), toast: $("toast"), resetButton: $("resetButton")
  };

  let worker = null;
  let inputFile = null;
  let outputBlob = null;
  let outputName = "";
  let report = null;
  let previewUrl = null;
  let soundEnabled = localStorage.getItem("whis_sound") !== "false";
  let audioContext = null;
  let toastTimer = null;

  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ui.toast.hidden = true;
    }, 2800);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let index = 0;
    while (value >= 1000 && index < units.length - 1) { value /= 1000; index++; }
    return `${value.toFixed(index ? (value < 10 ? 2 : 1) : 0)} ${units[index]}`;
  }

  function timestamp() {
    return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
  }

  function addLog(message, ok = false) {
    const line = document.createElement("p");
    const time = document.createElement("time");
    time.textContent = timestamp();
    line.append(time, document.createTextNode(message));
    if (ok) line.classList.add("ok");
    ui.log.append(line);
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  function tone(kind = "tap") {
    if (!soundEnabled) return;
    audioContext ||= new AudioContext();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const settings = {
      tap: [420, .025, .018], drop: [280, .07, .025], success: [620, .16, .035], error: [150, .18, .03]
    }[kind];
    oscillator.type = kind === "success" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(settings[0], now);
    if (kind === "success") oscillator.frequency.exponentialRampToValueAtTime(930, now + settings[1]);
    if (kind === "error") oscillator.frequency.exponentialRampToValueAtTime(95, now + settings[1]);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings[2], now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + settings[1]);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[1] + .02);
  }

  function setProgress(value, label, detail) {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    ui.progress.style.width = `${safe}%`;
    ui.glow.style.left = `${safe}%`;
    ui.percent.textContent = `${safe}%`;
    if (label) ui.status.textContent = label;
    if (detail) ui.detail.textContent = detail;

    // Pipeline visualizer transitions
    if (safe >= 25 && ui.stepFtyp && !ui.stepFtyp.classList.contains("complete")) {
      ui.stepFtyp.classList.replace("active", "complete");
      ui.stepMoov?.classList.add("active");
    }
    if (safe >= 75 && ui.stepMoov && !ui.stepMoov.classList.contains("complete")) {
      ui.stepMoov.classList.replace("active", "complete");
      ui.stepMdat?.classList.add("active");
    }
  }

  function resetResult() {
    outputBlob = null;
    report = null;
    ui.result.hidden = true;
    ui.error.hidden = true;
    ui.export.disabled = true;
    ui.details.disabled = true;
    ui.panel.hidden = true;
    ui.log.replaceChildren();
    ui.audit.replaceChildren();

    ui.stepFtyp?.classList.remove("active", "complete");
    ui.stepMoov?.classList.remove("active", "complete");
    ui.stepMdat?.classList.remove("active", "complete");
  }

  function startWorker(file) {
    worker?.terminate();
    worker = new Worker("worker.js");
    worker.onmessage = onWorkerMessage;
    worker.onerror = (event) => fail(event.message || "Unhandled worker error.");
    worker.postMessage({ type: "process", file });
  }

  function selectFile(file) {
    if (!file) return;
    inputFile = file;
    outputName = `${file.name.replace(/\.(mp4|mov|m4v)$/i, "")}_whis.mp4`;
    resetResult();
    ui.dropzone.hidden = true;
    ui.processor.hidden = false;
    ui.fileName.textContent = file.name;
    ui.fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "video/ISO-BMFF"}`;

    // Setup video preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    try {
      previewUrl = URL.createObjectURL(file);
      if (ui.videoPreview && ui.previewContainer) {
        ui.videoPreview.src = previewUrl;
        ui.previewContainer.hidden = false;
        ui.videoPreview.onloadedmetadata = () => {
          if (ui.videoResolution) {
            const w = ui.videoPreview.videoWidth;
            const h = ui.videoPreview.videoHeight;
            const dur = Math.round(ui.videoPreview.duration);
            ui.videoResolution.textContent = `${w}×${h} · ${dur}s`;
          }
        };
      }
    } catch {
      // Ignore preview errors for unsupported codec previews
    }

    ui.stepFtyp?.classList.add("active");
    setProgress(1, "Analyzing", "Reading the container structure");
    addLog(`Input: ${file.name} (${formatBytes(file.size)})`);
    tone("drop");
    startWorker(file);
  }

  function onWorkerMessage({ data }) {
    if (data.type === "progress") {
      setProgress(data.value, data.label, data.detail);
      if (data.log) addLog(data.log);
      return;
    }
    if (data.type === "done") {
      outputBlob = data.blob;
      report = data.report;
      setProgress(100, "Patch complete", "Output is ready to export");

      ui.stepFtyp?.classList.replace("active", "complete") || ui.stepFtyp?.classList.add("complete");
      ui.stepMoov?.classList.replace("active", "complete") || ui.stepMoov?.classList.add("complete");
      ui.stepMdat?.classList.replace("active", "complete") || ui.stepMdat?.classList.add("complete");

      ui.patchCount.textContent = Number(report.dummySamples).toLocaleString("en-US");
      ui.outputSize.textContent = formatBytes(outputBlob.size);
      const delta = outputBlob.size - inputFile.size;
      ui.sizeDelta.textContent = `${delta >= 0 ? "+" : ""}${formatBytes(delta)}`;
      ui.result.hidden = false;
      ui.export.disabled = false;
      ui.details.disabled = false;
      renderReport(report);
      addLog("Patch internally verified and assembled.", true);
      tone("success");
      showToast("Patching completed successfully!");
      return;
    }
    if (data.type === "error") fail(data.message, data.details);
  }

  function fail(message, details = "") {
    setProgress(0, "Not completed", "The original file was not modified");
    ui.errorMessage.textContent = message;
    ui.error.hidden = false;
    ui.export.disabled = true;
    ui.details.disabled = false;
    addLog(`ERROR: ${message}${details ? ` — ${details}` : ""}`);
    tone("error");
    showToast("Processing failed");
  }

  function auditRow(label, value) {
    const row = document.createElement("div");
    const name = document.createElement("span");
    const result = document.createElement("strong");
    name.textContent = label;
    result.textContent = value;
    row.append(name, result);
    return row;
  }

  function renderReport(data) {
    const rows = [
      ["Container", data.container], ["Input → output tracks", `${data.inputTracks} → ${data.outputTracks}`],
      ["Duplicated track", data.sourceAudio], ["Original samples", Number(data.sourceSamples).toLocaleString("en-US")],
      ["Technical samples", Number(data.dummySamples).toLocaleString("en-US")], ["Technical pattern", "8 B × sample"],
      ["Media payload", data.mediaPayloadPreserved ? "Unchanged" : "Losslessly rebuilt"],
      ["Identifiers", "Sanitized"], ["Offsets", data.offsetMode], ["Fast start", "Yes"]
    ];
    ui.audit.replaceChildren(...rows.map(([a, b]) => auditRow(a, b)));
  }

  async function exportOutput() {
    if (!outputBlob) return;
    tone("tap");
    ui.export.disabled = true;
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: outputName,
          types: [{ description: "MPEG-4 video", accept: { "video/mp4": [".mp4"] } }]
        });
        const writable = await handle.createWritable();
        const reader = outputBlob.stream().getReader();
        let written = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
          written += value.byteLength;
          setProgress(100 * written / outputBlob.size, "Exporting", `${formatBytes(written)} of ${formatBytes(outputBlob.size)}`);
        }
        await writable.close();
      } else if (typeof chrome !== "undefined" && chrome.downloads?.download) {
        const url = URL.createObjectURL(outputBlob);
        await chrome.downloads.download({ url, filename: outputName, saveAs: true });
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        // Universal web fallback for any browser
        const url = URL.createObjectURL(outputBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outputName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setProgress(100, "Exported", outputName);
      addLog(`Saved: ${outputName}`, true);
      showToast(`Saved ${outputName}`);
      tone("success");
    } catch (error) {
      if (error.name !== "AbortError") fail(`Export failed: ${error.message}`);
    } finally {
      ui.export.disabled = !outputBlob;
    }
  }

  function resetAll() {
    tone("tap");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    if (ui.videoPreview) ui.videoPreview.src = "";
    if (ui.previewContainer) ui.previewContainer.hidden = true;
    resetResult();
    ui.processor.hidden = true;
    ui.dropzone.hidden = false;
    ui.fileInput.value = "";
    inputFile = null;
    outputBlob = null;
    outputName = "";
  }

  function choose() { ui.fileInput.value = ""; ui.fileInput.click(); }

  ui.browse.addEventListener("click", (event) => { event.stopPropagation(); tone("tap"); choose(); });
  ui.dropzone.addEventListener("click", choose);
  ui.dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") choose(); });
  ui.fileInput.addEventListener("change", () => selectFile(ui.fileInput.files[0]));
  ui.replace.addEventListener("click", () => { tone("tap"); choose(); });
  ui.export.addEventListener("click", exportOutput);
  ui.resetButton?.addEventListener("click", resetAll);

  ui.details.addEventListener("click", () => {
    ui.panel.hidden = false;
    ui.panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    tone("tap");
  });
  ui.closeDetails.addEventListener("click", () => { ui.panel.hidden = true; tone("tap"); });

  ui.copyLogButton?.addEventListener("click", async () => {
    tone("tap");
    const text = ui.log ? ui.log.innerText : "";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Execution trace copied!");
    } catch {
      showToast("Unable to copy trace");
    }
  });

  // Sound preference toggle & persistence
  if (!soundEnabled) {
    ui.sound.setAttribute("aria-pressed", "false");
    ui.sound.setAttribute("aria-label", "Enable interface sounds");
  }
  ui.sound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("whis_sound", String(soundEnabled));
    ui.sound.setAttribute("aria-pressed", String(soundEnabled));
    ui.sound.setAttribute("aria-label", soundEnabled ? "Mute interface sounds" : "Enable interface sounds");
    if (soundEnabled) tone("tap");
  });

  for (const eventName of ["dragenter", "dragover"]) {
    ui.dropzone.addEventListener(eventName, (event) => { event.preventDefault(); ui.dropzone.classList.add("is-dragging"); });
  }
  for (const eventName of ["dragleave", "drop"]) {
    ui.dropzone.addEventListener(eventName, (event) => { event.preventDefault(); ui.dropzone.classList.remove("is-dragging"); });
  }
  ui.dropzone.addEventListener("drop", (event) => selectFile([...event.dataTransfer.files].find((file) => file.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(file.name))));
})();
