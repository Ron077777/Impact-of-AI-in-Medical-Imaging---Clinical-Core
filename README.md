# Impact of AI in Medical Imaging - Clinical Core

Clinical Core is a high precision, decoupled local edge computing intelligence platform designed to assist radiologists in identifying anomalous signatures, specifically **Tuberculosis (TB)** and **Pulmonary Tumors** directly from 2D chest radiographs.

By operating entirely on local edge hardware, the system bypasses the data privacy vulnerabilities, high latency, and cloud infrastructure overhead typical of modern medical AI tools, ensuring strict compliance with healthcare privacy boundaries regarding Protected Health Information (PHI).

---

## Key Engineering Benchmarks

- **Ultra-Low Latency:** Optimized YOLOv8 Nano inference engine handles heavy tensor mathematics in exactly **2.2ms** on consumer edge hardware.
- **Compact Parameters:** Model architecture compiled and stripped down to a **5.4MB** weight footprint for rapid caching directly into VRAM.
- **Deterministic Guardrails:** Implements algorithmic RGB channel disagreement monitoring to detect and automatically reject non radiograph image tampering before executing GPU cycles.

---

## System Architecture & Stack

The platform is engineered using a highly decoupled micro architecture partitioned into three core operational layers:

1. **Presentation Layer (Frontend)**
   - Built with **Next.js** and **Tailwind CSS**.
   - Implements a low latency UI viewport via the **HTML5 Canvas API** to securely process asynchronous model coordinate tracking and handle dynamic zoom, pan, and real time canvas scaling without UI blocking.

2. **Application Layer (Backend)**
   - Powered by **FastAPI (Python)** using an asynchronous non blocking design pattern.
   - Leverages a cached **Lazy Singleton Pattern** to pin the deep learning network directly into memory on boot, completely removing secondary disk I/O bottlenecks.

3. **Persistence Layer (Database)**
   - Managed via an ACID compliant **PostgreSQL** cluster.
   - Utilizes safe **UUIDv4 tokens** instead of raw auto incrementing sequential primary keys to explicitly prevent sequential data scraping threats.

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
```

---

## Local Environment Setup

### 1. Application Layer (Backend)

> Requires **Python 3.10+**

```bash
# Navigate to the backend directory
cd backend

# Create an isolated virtual environment
python -m venv venv

# Activate the environment
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Presentation Layer (Frontend)

> Requires **Node.js v18+**

```bash
# Navigate to the frontend directory
cd ../frontend

# Install dependencies
npm install

# Start the development client
npm run dev
```

The client dashboard will be available at `http://localhost:3000`.

---

## Software Quality & Testing

- **Sanity Validation:** Integrated backend schema validators confirm multi part image binaries fit explicit spatial dimensional footprints before moving down the operational array.
- **Automated Clinical Compilation:** Generates dynamic, standard compliant A4 documentation layouts instantly via a decoupled Python FPDF rendering task to guarantee immediate physical utility in field units.
- **Robust Integration Pools:** Implements explicit thread pooling inside the ORM layer to elegantly serialize database handoffs under heavy local workload spikes.

---

## Engineering Roadmap

- **Multi-Class Diagnostic Taxonomy Expansion:** Scaling weights to cover secondary pulmonary profiles (Pneumonia, Cardiomegaly, COVID-19 variations).
- **Native DICOM Extraction:** Building an extraction pipe to read uncompressed DICOM pixel maps directly from local PACS hospital infrastructure without translation tools.
- **3D Volumetric Processing:** Translating 2D tensor arrays into 3D voxel based spatial networks to parse heavy localized CT and MRI slices seamlessly.
