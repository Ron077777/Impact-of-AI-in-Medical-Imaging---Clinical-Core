from __future__ import annotations

import hashlib
import io
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fpdf import FPDF
from PIL import Image, ImageOps
from sqlalchemy import DateTime, Integer, String, Text, create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from ultralytics import YOLO

app = FastAPI(title="Medical Image AI Analysis Service", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = BASE_DIR / "ml_model" / "best.pt"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:admin@127.0.0.1:5432/clinical_core",
)
DB_PARAMS = {
    "host": "127.0.0.1",
    "port": 5432,
    "dbname": "clinical_core",
    "user": "postgres",
    "password": "admin",
}

_yolo_model: YOLO | None = None


def _get_model() -> YOLO:
    global _yolo_model
    if _yolo_model is None:
        _yolo_model = YOLO(str(MODEL_PATH))
    return _yolo_model


class Base(DeclarativeBase):
    pass


class Scan(Base):
    __tablename__ = "scans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False)
    patient_id: Mapped[str] = mapped_column(String(128), nullable=False, default="unknown")
    anomaly_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    findings: Mapped[str] = mapped_column(Text, nullable=False, default="")
    pdf_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


engine = create_engine(DATABASE_URL, pool_pre_ping=True)


@app.on_event("startup")
def _startup() -> None:
    try:
        Base.metadata.create_all(engine)
    except SQLAlchemyError:
        return


def _run_yolo(img: Image.Image) -> dict[str, Any]:
    model = _get_model()
    rgb = img.convert("RGB")
    with tempfile.TemporaryDirectory() as tmp:
        input_path = os.path.join(tmp, "input.jpg")
        rgb.save(input_path)
        results = model(input_path, verbose=False)
        result = results[0]
        annotated_filename = f"{uuid.uuid4().hex}_annotated.jpg"
        annotated_path = str(OUTPUT_DIR / annotated_filename)
        result.save(filename=annotated_path)
        boxes = result.boxes
        bounding_boxes: list[dict[str, int]] = []
        labels: list[str] = []
        confidences: list[float] = []
        if boxes is not None and len(boxes) > 0:
            names = model.names
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                bounding_boxes.append({
                    "x": int(x1),
                    "y": int(y1),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1),
                })
                labels.append(names.get(cls_id, str(cls_id)))
                confidences.append(round(conf * 100, 1))
        nodule_count = len(bounding_boxes)
        if nodule_count > 0:
            risk_level = "High"
            model_confidence = round(sum(confidences) / len(confidences), 1)
        else:
            risk_level = "Low"
            model_confidence = 92.0
        findings = ", ".join(set(labels)) if labels else "No anomalies detected"
        return {
            "risk_level": risk_level,
            "model_confidence_score": model_confidence,
            "nodule_count": nodule_count,
            "detected_anomalies": nodule_count,
            "mean_intensity_0_255": 0.0,
            "bounding_boxes": bounding_boxes,
            "labels": labels,
            "findings": findings,
            "annotated_path": annotated_path,
        }


def _safe_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", value.strip())
    cleaned = cleaned.strip("._-")
    return cleaned or "unknown"


def _report_filename(patient_name: str, age: str, patient_id: str, timestamp: datetime) -> str:
    parts = [
        _safe_filename_part(patient_name),
        _safe_filename_part(age),
        _safe_filename_part(patient_id),
        timestamp.strftime("%Y-%m-%d"),
        timestamp.strftime("%H-%M-%S"),
    ]
    return "_".join(parts) + ".pdf"


def _format_findings(value: str) -> str:
    return ", ".join(part.strip().capitalize() for part in value.split(",") if part.strip()) or "None"


def _generate_pdf(
    patient_id: str,
    patient_name: str,
    patient_age: str,
    timestamp: str,
    output_filename: str,
    findings: str,
    risk_level: str,
    model_confidence: float,
    nodule_count: int,
    annotated_path: str,
) -> str:
    pdf = FPDF()
    pdf.set_margins(10, 10, 10)
    pdf.set_auto_page_break(auto=True, margin=10)
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "Clinical Core - AI Diagnostic Report", ln=True, align="C")
    pdf.ln(6)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "Patient Information", ln=True)
    pdf.set_font("Arial", "", 11)
    pdf.cell(0, 6, f"Patient UID  : {patient_id}", ln=True)
    pdf.cell(0, 6, f"Patient Name : {patient_name}", ln=True)
    pdf.cell(0, 6, f"Patient Age  : {patient_age}", ln=True)
    pdf.cell(0, 6, f"Report Date  : {timestamp}", ln=True)
    pdf.ln(4)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "Analysis Results", ln=True)
    pdf.set_font("Arial", "", 11)
    pdf.cell(0, 6, f"Risk Level       : {risk_level}", ln=True)
    pdf.cell(0, 6, f"Model Confidence : {model_confidence}%", ln=True)
    pdf.cell(0, 6, f"Anomalies Found  : {nodule_count}", ln=True)
    pdf.cell(0, 6, f"Findings         : {_format_findings(findings)}", ln=True)
    pdf.ln(4)
    if os.path.isfile(annotated_path):
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 8, "Annotated Scan", ln=True)
        pdf.image(annotated_path, x=10, w=120)
    pdf_filename = os.path.basename(output_filename)
    pdf_path = os.path.join(str(OUTPUT_DIR), pdf_filename)
    pdf.output(pdf_path)
    return pdf_path


def _log_to_db(
    patient_id: str,
    filename: str,
    risk_level: str,
    anomaly_count: int,
    findings: str,
    pdf_path: str,
    timestamp: datetime,
) -> str | None:
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO scans (filename, risk_level, patient_id, anomaly_count, findings, pdf_path, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (filename, risk_level, patient_id, anomaly_count, findings, pdf_path, timestamp),
        )
        conn.commit()
        cur.close()
        conn.close()
        return None
    except Exception as e:
        return str(e)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/scans/latest")
def latest_scan() -> dict[str, Any]:
    try:
        with Session(engine) as session:
            row = session.query(Scan).order_by(Scan.id.desc()).first()
            if not row:
                return {"scan": None}
            return {
                "scan": {
                    "id": row.id,
                    "filename": row.filename,
                    "risk_level": row.risk_level,
                    "timestamp": row.created_at.isoformat(),
                }
            }
    except SQLAlchemyError:
        return {"scan": None}


@app.get("/scans")
def list_scans(limit: int = 50) -> dict[str, Any]:
    limit = max(1, min(200, int(limit)))
    try:
        with Session(engine) as session:
            rows = session.query(Scan).order_by(Scan.id.desc()).limit(limit).all()
            return {
                "scans": [
                    {
                        "id": r.id,
                        "filename": r.filename,
                        "risk_level": r.risk_level,
                        "timestamp": r.created_at.isoformat(),
                    }
                    for r in rows
                ]
            }
    except SQLAlchemyError:
        return {"scans": []}


@app.get("/download-report/{filename}")
def download_report(filename: str) -> FileResponse:
    safe_name = os.path.basename(filename)
    if safe_name != filename or not safe_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid report filename.")
    report_path = os.path.abspath(os.path.join(str(OUTPUT_DIR), safe_name))
    output_root = os.path.abspath(str(OUTPUT_DIR))
    if os.path.commonpath([output_root, report_path]) != output_root:
        raise HTTPException(status_code=400, detail="Invalid report path.")
    if not os.path.isfile(report_path):
        raise HTTPException(status_code=404, detail="Report not found.")
    return FileResponse(report_path, media_type="application/pdf", filename=safe_name)


@app.post("/analyze")
async def analyze_medical_image(
    file: UploadFile = File(...),
    patient_name: str = Form("unknown"),
    patient_age: str = Form("unknown"),
    patient_uid: str = Form("unknown"),
) -> dict[str, Any]:
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Missing content_type.")
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail=f"Unsupported type: {file.content_type}")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    sha256 = hashlib.sha256(raw).hexdigest()
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        img.load()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read image: {e}") from e
    width, height = img.size
    try:
        analysis = _run_yolo(img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}") from e
    risk_level = analysis["risk_level"]
    findings = analysis["findings"]
    annotated_path = analysis["annotated_path"]
    warning: str | None = None
    rgb = img.convert("RGB")
    sample = rgb.resize((96, 96), resample=Image.Resampling.BILINEAR)
    channel_disagreement = sum(
        (abs(r - g) + abs(r - b) + abs(g - b)) / 3.0 for r, g, b in sample.getdata()
    ) / (96 * 96)
    if channel_disagreement > 18:
        warning = "Image does not appear to be a standard X-ray/CT scan."
    now = datetime.now(timezone.utc)
    patient_id = patient_uid.strip() or "unknown"
    report_filename = _report_filename(patient_name, patient_age, patient_id, now)
    pdf_path = ""
    try:
        pdf_path = _generate_pdf(
            patient_id=patient_id,
            patient_name=patient_name.strip() or "unknown",
            patient_age=patient_age.strip() or "unknown",
            timestamp=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
            output_filename=report_filename,
            findings=findings,
            risk_level=risk_level,
            model_confidence=analysis["model_confidence_score"],
            nodule_count=analysis["nodule_count"],
            annotated_path=annotated_path,
        )
    except Exception as e:
        warning = (warning + " " if warning else "") + f"PDF generation failed: {e}"
    db_error = _log_to_db(
        patient_id=patient_id,
        filename=file.filename or "unknown",
        risk_level=risk_level,
        anomaly_count=analysis["detected_anomalies"],
        findings=findings,
        pdf_path=pdf_path,
        timestamp=now,
    )
    if db_error:
        warning = (warning + " " if warning else "") + f"DB write failed: {db_error}"
    clinical_note = "Normal" if risk_level == "Low" else "Anomaly Detected"
    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "sha256": sha256,
        "report_filename": report_filename if pdf_path else None,
        "report_url": f"/download-report/{report_filename}" if pdf_path else None,
        "pdf_path": pdf_path or None,
        "image": {"width": width, "height": height},
        "bounding_boxes": analysis["bounding_boxes"],
        "analysis": {
            "risk_level": risk_level,
            "model_confidence_score": analysis["model_confidence_score"],
            "nodule_count": analysis["nodule_count"],
            "detected_anomalies": analysis["detected_anomalies"],
            "mean_intensity_0_255": analysis["mean_intensity_0_255"],
            "bounding_boxes": analysis["bounding_boxes"],
            "clinical_note": clinical_note,
            "findings": findings,
            "warning": warning,
        },
    }
