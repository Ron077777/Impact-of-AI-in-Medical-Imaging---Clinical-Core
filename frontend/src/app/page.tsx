"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { BoundingBox } from "../components/MedicalViewport";

type RiskLevel = "Low" | "Moderate" | "High";

type AnalyzeResponse = {
  filename?: string;
  content_type?: string;
  report_filename?: string | null;
  report_url?: string | null;
  pdf_path?: string | null;
  image?: { width?: number; height?: number };
  bounding_boxes?: BoundingBox[];
  analysis?: {
    risk_level?: RiskLevel;
    model_confidence_score?: number | string;
    confidence_score?: number | string;
    detected_anomalies?: number;
    mean_intensity_0_255?: number;
    nodule_count?: number | string;
    bounding_boxes?: BoundingBox[];
    warning?: string | null;
    clinical_note?: string | null;
    findings?: string | null;
  };
};

type LatestScan = { filename?: string; risk_level?: string; timestamp?: string };

const MedicalViewport = dynamic(() => import("../components/MedicalViewport"), { ssr: false });

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [reportTimestamp, setReportTimestamp] = useState<Date | null>(() => new Date());
  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [patientUid, setPatientUid] = useState("B-402");
  const [patientName, setPatientName] = useState("John Doe");
  const [patientAge, setPatientAge] = useState("");
  const [editingUid, setEditingUid] = useState(false);
  const uidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLatest() {
      try {
        const res = await fetch("http://127.0.0.1:8000/scans/latest");
        const data = await res.json().catch(() => null);
        if (!cancelled) setLatestScan(getLatestScan(data));
      } catch { if (!cancelled) setLatestScan(null); }
    }
    loadLatest();
    const t = setInterval(loadLatest, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (editingUid && uidInputRef.current) uidInputRef.current.focus();
  }, [editingUid]);

  const contentType = result?.content_type ?? "—";
  const w = result?.image?.width ?? "—";
  const h = result?.image?.height ?? "—";
  const medicalFindings = formatFindings(result?.analysis?.findings);
  const riskLevel = result?.analysis?.risk_level;
  const modelConfidence = result?.analysis?.model_confidence_score ?? result?.analysis?.confidence_score;
  const anomalies = result?.analysis?.detected_anomalies;
  const warning = result?.analysis?.warning;
  const boundingBoxes = getBoundingBoxes(result);
  const riskUi = getRiskUi(riskLevel);
  const clinicalNote = riskLevel === "Low"
    ? "Low Risk: No visible anomaly found"
    : riskLevel ? `${riskLevel} Risk Anomaly Detected: Consult a Doctor Immediately` : "—";
  const reportFilename = result?.report_filename ?? getBasename(result?.pdf_path) ?? null;
  const reportUrl = result?.report_url ?? (reportFilename ? `/download-report/${reportFilename}` : null);

  function onPick(next: File | null) {
    setError(null); setResult(null); setFile(next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function onAnalyze() {
    setError(null); setResult(null);
    if (!file) { setError("Please choose an image file first."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("patient_name", patientName);
      fd.set("patient_age", patientAge);
      fd.set("patient_uid", patientUid);
      const res = await fetch("http://127.0.0.1:8000/analyze", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail) : null)
          ?? `Request failed with status ${res.status}.`;
        throw new Error(msg);
      }
      setResult(data);
      setReportTimestamp(new Date());
      try {
        const r2 = await fetch("http://127.0.0.1:8000/scans/latest");
        const db = await r2.json().catch(() => null);
        setLatestScan(getLatestScan(db));
      } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally { setBusy(false); }
  }

  function onDownloadPdf() {
    if (!reportUrl) return;
    const url = reportUrl.startsWith("http")
      ? reportUrl
      : `http://127.0.0.1:8000${reportUrl.startsWith("/") ? reportUrl : `/${reportUrl}`}`;
    window.location.href = url;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Clinical Core: AI Diagnostic Intelligence Platform</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Upload an image to run analysis and view results.</p>
        </header>

        <main className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="grid grid-cols-1 gap-6">
              <Card title="Patient Info" subtitle="Enter details before scanning">
                <div className="grid gap-3">
                  <div className="flex items-baseline justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0 leading-none">Patient UID</div>
                    {editingUid ? (
                      <input
                        ref={uidInputRef}
                        className="text-xs font-semibold bg-transparent border-b border-zinc-400 dark:border-zinc-500 outline-none text-right min-w-0 flex-1 text-zinc-900 dark:text-white"
                        value={patientUid}
                        onChange={(e) => setPatientUid(e.target.value)}
                        onBlur={() => setEditingUid(false)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingUid(false); }}
                      />
                    ) : (
                      <button type="button" onClick={() => setEditingUid(true)} className="text-xs font-semibold text-zinc-900 dark:text-white text-right truncate max-w-[120px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Click to edit">
                        {patientUid}
                      </button>
                    )}
                  </div>
                  <EditableField label="Patient Name" value={patientName} onChange={setPatientName} placeholder="e.g. John Doe" />
                  <EditableField label="Patient Age" value={patientAge} onChange={setPatientAge} placeholder="e.g. 45" />
                  <KeyValue k="Timestamp" v={latestScan?.timestamp ? new Date(latestScan.timestamp).toLocaleString() : "—"} />
                </div>
              </Card>
              <Card title="Report">
                <button type="button" onClick={onDownloadPdf} disabled={!result || !reportUrl}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                  Download Report File
                </button>
                <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {reportUrl ? "Report ready. Click to download." : "Run analysis first to generate report."}
                </div>
              </Card>
            </div>
          </aside>

          <section className="lg:col-span-9">
            <div className="grid grid-cols-1 gap-6">
              <Card title="Upload" subtitle="Choose an image file to analyze">
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Image file</span>
                    <input type="file" accept="image/*"
                      className="block w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
                      onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
                  </label>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <MedicalViewport imageUrl={previewUrl} boundingBoxes={boundingBoxes} />
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Clinical Analysis</div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Derived from backend response</div>
                        </div>
                        <span className={["rounded-full px-2.5 py-1 text-xs font-semibold", riskUi.badgeClass].join(" ")}>{riskLevel ?? "—"}</span>
                      </div>
                      {warning ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">{warning}</div> : null}
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <MiniStat label="Risk level" value={riskUi.label} valueClassName={riskUi.valueClassName} />
                        <MiniStat label="Model confidence score" value={typeof modelConfidence === "number" ? `${modelConfidence.toFixed(1)}%` : typeof modelConfidence === "string" ? modelConfidence : "—"} />
                        <MiniStat label="Clinical note" value={clinicalNote} />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={onAnalyze} disabled={busy}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                    {busy ? "Analyzing..." : "Analyze image"}
                  </button>
                  {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
                </div>
              </Card>
              <Card title="Clinical Findings" subtitle="Scan assessment summary"
                headerRight={<div className="text-xs text-zinc-500 dark:text-zinc-400">{reportTimestamp ? reportTimestamp.toLocaleString() : ""}</div>}
                className="border-zinc-300 dark:border-zinc-700">
                {warning ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">{warning}</div> : null}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Stat label="Risk level" value={riskUi.label} valueClassName={riskUi.valueClassName} />
                  <Stat label="Model confidence score" value={typeof modelConfidence === "number" ? `${modelConfidence.toFixed(1)}%` : typeof modelConfidence === "string" ? modelConfidence : "—"} />
                  <Stat label="Medical Findings" value={medicalFindings} />
                  <Stat label="Detected anomalies" value={typeof anomalies === "number" ? String(anomalies) : "—"} />
                  <div className="sm:col-span-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Clinical note</div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-zinc-900 dark:text-white">{clinicalNote}</div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card title="Technical Metadata">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Stat label="Scan file type" value={String(contentType)} />
                  <Stat label="Dimensions" value={`${w} × ${h}`} />
                </div>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function getLatestScan(data: unknown): LatestScan | null {
  if (!data || typeof data !== "object" || !("scan" in data)) return null;
  const scan = (data as { scan?: unknown }).scan;
  if (!scan || typeof scan !== "object") return null;
  return scan as LatestScan;
}

function getBoundingBoxes(result: AnalyzeResponse | null): BoundingBox[] {
  const boxes = result?.analysis?.bounding_boxes ?? result?.bounding_boxes ?? [];
  if (!Array.isArray(boxes)) return [];
  return boxes.filter(
    (box): box is BoundingBox =>
      Number.isFinite(box?.x) && Number.isFinite(box?.y) &&
      Number.isFinite(box?.width) && Number.isFinite(box?.height),
  );
}

function getBasename(path?: string | null): string | null {
  if (!path) return null;
  return path.split(/[\\/]/).pop() || null;
}

function formatFindings(value?: string | null): string {
  if (!value) return "—";
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(", ") || "—";
}

function getRiskUi(riskLevel: "Low" | "Moderate" | "High" | undefined): { label: string; valueClassName: string; badgeClass: string; clinicalLabel: string; } {
  if (riskLevel === "High") return { label: "High", clinicalLabel: "Anomaly Detected", valueClassName: "text-red-700 dark:text-red-300", badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200" };
  if (riskLevel === "Moderate") return { label: "Moderate", clinicalLabel: "Anomaly Detected", valueClassName: "text-amber-700 dark:text-amber-300", badgeClass: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" };
  if (riskLevel === "Low") return { label: "Low", clinicalLabel: "Normal", valueClassName: "text-emerald-700 dark:text-emerald-300", badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" };
  return { label: "—", clinicalLabel: "—", valueClassName: "text-zinc-900 dark:text-white", badgeClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function Card({ title, subtitle, headerRight, className, children }: { title: string; subtitle?: string; headerRight?: ReactNode; className?: string; children: ReactNode; }) {
  return (
    <section className={["rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:p-6", className ?? ""].join(" ")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{subtitle}</p> : null}
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KeyValue({ k, v, wrap = false }: { k: string; v: string; wrap?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">{k}</div>
      <div className={[
        "min-w-0 max-w-[11rem] text-right text-xs font-semibold text-zinc-900 dark:text-white",
        wrap ? "whitespace-normal break-words" : "truncate",
      ].join(" ")}>
        {v}
      </div>
    </div>
  );
}

function Stat({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={["mt-1 whitespace-pre-wrap break-words text-sm font-semibold", valueClassName ?? "text-zinc-900 dark:text-white"].join(" ")}>{value}</div>
    </div>
  );
}

function EditableField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">{label}</div>
      <input
        className="text-xs font-semibold bg-transparent outline-none text-right min-w-0 flex-1 text-zinc-900 dark:text-white placeholder:text-zinc-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function MiniStat({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={["mt-1 whitespace-pre-wrap break-words text-xs font-semibold", valueClassName ?? ""].join(" ")}>{value}</div>
    </div>
  );
}
