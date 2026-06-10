# Impact-of-AI-in-Medical-Imaging---Clinical-Core

Clinical Core is a high-precision, decoupled local edge-computing intelligence platform designed to assist radiologists in identifying anomalous signatures specifically **Tuberculosis (TB)** and **Pulmonary Tumors**—directly from 2D chest radiographs. 

By operating entirely localized on edge hardware, the system completely bypasses the data privacy vulnerabilities, high latency, and cloud infrastructure subscription overhead typical of modern medical AI tools, ensuring strict compliance with healthcare privacy boundaries regarding Protected Health Information (PHI).

## Key Engineering Benchmarks
* **Ultra-Low Latency:** Optimized YOLOv8 Nano inference engine handles heavy tensor mathematics in exactly **2.2ms** on consumer edge hardware.
* **Compact Parameters:** Model architecture compiled and stripped down to a **5.4MB** weight footprint for rapid caching directly into VRAM.
* **Deterministic Guardrails:** Implements algorithmic RGB channel disagreement monitoring to detect and automatically reject non radiograph image tampering before executing GPU cycles.

---

## System Architecture & Stack

The platform is engineered using a highly decoupled micro-architecture partitioned into three core operational layers:

1. **Presentation Layer (Frontend):** * Built with **Next.js** and **Tailwind CSS**.
   * Implements a low latency UI viewport via the **HTML5 Canvas API** to securely process asynchronous model coordinate tracking and handle dynamic zoom, pan, and real time canvas scaling without UI blocking.
2. **Application Layer (Backend):**
   * Powered by **FastAPI (Python)** using an asynchronous non-blocking design pattern.
   * Leverages a cached **Lazy Singleton Pattern** to pin the deep learning network directly into memory on boot, completely removing secondary disk I/O bottlenecks.
3. **Persistence Layer (Database):**
   * Managed via an ACID-compliant **PostgreSQL** cluster.
   * Utilizes safe **UUIDv4 tokens** instead of raw auto-incrementing sequential primary keys to explicitly prevent sequential data-scraping threats.

---

## Repository Structure

```text
clinical-core-platform/
│
├── backend/                  # Asynchronous FastAPI Service
│   ├── model/
│   │   └── best.pt           # Optimized 5.4MB YOLOv8 weight parameters
│   ├── outputs/              # Volatile clinical exports (cleared via .gitkeep)
│   ├── main.py               # Application execution entry point
│   └── requirements.txt      # Python package manifest
│
├── frontend/                 # Client Workspace
│   ├── src/                  # Next.js workspace & canvas core layers
│   ├── package.json          # Node.js dependencies
│   └── tailwind.config.js    # Interface style definitions
│
└── README.md                 # System operational manual
