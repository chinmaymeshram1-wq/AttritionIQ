# AttritionIQ

**Enterprise AI/ML Employee Attrition Prediction & Workforce Risk Intelligence Platform**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4.2-F7931E.svg?logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![Tests](https://img.shields.io/badge/Tests-29%20Passed-brightgreen.svg)]()

---

## Overview

**AttritionIQ** is an AI/ML-powered employee attrition prediction and HR analytics platform designed to transform workforce data into proactive, explainable, and actionable retention strategies. Modern organizations face significant financial and institutional knowledge loss from voluntary employee turnover. Traditional HR analytics models report attrition retrospectively after employees have already exited.

AttritionIQ shifts the paradigm from reactive post-exit reporting to proactive, explainable risk management. By combining supervised machine learning classification, local explainability via SHAP (SHapley Additive exPlanations), aggregated workforce analytics, scenario sensitivity simulations (What-If analysis), conversational AI powered by Google Gemini, and a risk-stratified Contact Intelligence directory, AttritionIQ equips HR leaders with end-to-end decision-support intelligence.

---

## 1. Features

| Module | Purpose & Functionality |
|---|---|
| **Dashboard** | Executive command center displaying real-time workforce KPIs (Total Employees, High/Medium/Low Risk counts, Average Attrition Probability, Cumulative Predictions), active background operations tracker, and live system component health indicators. |
| **Dataset Manager** | Multi-dataset management architecture supporting up to **7 independent CSV datasets** per organization. Enforces isolated employee records, prediction histories, and analytics per dataset with automatic dataset numbering (`Dataset 01` to `Dataset 07`) and quota management. |
| **Employee Search** | Dataset-driven in-memory employee profile lookup by Employee ID across uploaded CSV files. Features schema compatibility validation reports, feature snapshots, historical prediction records, and linked contact details. |
| **Individual Prediction** | Single-employee risk assessment form spanning 30 workplace, demographic, compensation, and satisfaction parameters. Computes instant attrition probability ($0.0 \le p \le 1.0$), assigns risk tiers, ranks top SHAP risk-contributing and protective factors, and offers 1-click export to What-If simulation. |
| **Batch Prediction** | High-throughput multi-employee risk scoring via CSV upload. Performs automated schema compatibility grading (`FULLY_COMPATIBLE`, `PARTIALLY_COMPATIBLE`, `INCOMPATIBLE`), imputes missing features for partial datasets with `is_estimated=True` flags, and provides searchable results tables with CSV export. |
| **Analytics** | Executive-grade data visualizations including Overall Risk Tier Distribution donut charts, Overtime Status comparative probability bars, Departmental Risk breakdowns, and Job Role turnover stacked charts with high-precision tooltips. |
| **What-If Analysis** | Interactive sensitivity simulator enabling HR partners to modify compensation hikes, overtime requirements, stock options, job satisfaction, and work-life balance scores in real time to calculate estimated risk deltas ($\Delta p$). |
| **AI HR Assistant** | Context-aware conversational AI powered by Google Gemini 1.5 Flash. Injects employee metrics, risk tiers, and top SHAP factor attributions directly into chat prompts with safety guardrails strictly prohibiting punitive or automated termination advice. Features 24-hour persistent conversation history. |
| **Contact Intelligence** | Risk-stratified workforce contact directory dynamically synchronized with the active dataset. Displays verified employee contact details (Name, Email, Phone, Address, Department, Job Role, Risk Level) with 1-click clipboard copying and tier-based filtering (`ALL`, `HIGH`, `MEDIUM`, `LOW`). |

---

## 2. System Architecture

AttritionIQ is architected as a decoupled, multi-tier full-stack system:

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Client Layer                     │
│  React 18  •  TypeScript  •  Vite  •  Tailwind CSS          │
│  Zustand Stores  •  TanStack React Query  •  Recharts       │
└──────────────────────────────┬──────────────────────────────┘
                               │  HTTP / JSON REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                     │
│  Uvicorn ASGI  •  OAuth2 Password Flow + JWT Bearer Auth    │
│  Routers: /auth  •  /datasets  •  /employees  •  /prediction │
│           /analytics  •  /what-if  •  /dashboard  •  /ai     │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  Relational Database Layer   │ │    ML & Explainability      │
│  SQLite 3 (aiosqlite)        │ │  Scikit-Learn Pipeline      │
│  SQLAlchemy 2.0 Async ORM    │ │  SHAP Linear Explainer      │
│  Multi-Tenant Organizations  │ │  Serialized PKL & JSON      │
└──────────────────────────────┘ └─────────────┬───────────────┘
                                               │
                                               ▼
                                 ┌─────────────────────────────┐
                                 │   External AI Integration   │
                                 │   Google Gemini 1.5 Flash   │
                                 └─────────────────────────────┘
```

### End-to-End Data Flow

```
Browser UI Request
       │
       ▼
Frontend Service Layer (Axios / TanStack Query)
       │
       ▼
FastAPI REST Endpoints (/prediction, /datasets, /employees, etc.)
       │
       ▼
Authentication & Validation (JWT Bearer Token + Pydantic v2 Schemas)
       │
       ▼
Business Service Layer (PredictionService, BatchService, AnalyticsService, AIService)
       │
       ├───────────────────────────────┬──────────────────────────────┐
       ▼                               ▼                              ▼
Database Access Layer          ML Inference Engine             Gemini AI SDK
(SQLAlchemy 2.0 Async Session) (Pipeline .predict_proba)       (Advisory Prompts)
       │                               │                              │
       ▼                               ▼                              │
SQLite Storage (attrition.db)   SHAP Feature Attribution              │
       │                               │                              │
       └───────────────────────────────┴──────────────────────────────┘
                               │
                               ▼
HTTP JSON Response (Sanitized against NaN / Invalids)
       │
       ▼
Frontend Reactive State Update (Zustand Stores & Recharts Visualizations)
```

---

## 3. Repository Structure

```
AttritionIQ/
├── backend/                            # FastAPI Python Backend
│   ├── app/                            # Application Package
│   │   ├── ai/                         # Generative AI Module
│   │   │   ├── __init__.py
│   │   │   └── assistant.py            # Gemini 1.5 Flash assistant & safety guardrails
│   │   ├── api/                        # REST API Router Endpoints
│   │   │   ├── __init__.py
│   │   │   ├── ai.py                   # /ai conversational assistant router
│   │   │   ├── analytics.py            # /analytics workforce aggregation router
│   │   │   ├── auth.py                 # /auth authentication & registration router
│   │   │   ├── dashboard.py            # /dashboard summary & demo reset router
│   │   │   ├── datasets.py             # /datasets multi-dataset management router
│   │   │   ├── employees.py            # /employees profile, search & contact router
│   │   │   ├── prediction.py           # /prediction individual & batch router
│   │   │   └── whatif.py               # /what-if scenario simulation router
│   │   ├── auth/                       # Security & Session Infrastructure
│   │   │   ├── __init__.py
│   │   │   ├── dependencies.py         # JWT bearer extraction & active user validation
│   │   │   └── security.py             # Password hashing (bcrypt) & JWT token creation
│   │   ├── database/                   # Database Engine & Seeding
│   │   │   ├── __init__.py
│   │   │   ├── base.py                 # SQLAlchemy DeclarativeBase
│   │   │   ├── init_db.py              # Database initialization routines
│   │   │   ├── seed.py                 # Default organization & demo users seeder
│   │   │   └── session.py              # Async engine & sessionmaker (aiosqlite)
│   │   ├── ml/                         # Machine Learning Pipeline & Explainability
│   │   │   ├── artifacts/              # Serialized ML artifacts
│   │   │   │   ├── feature_names.json  # 30 canonical model feature names
│   │   │   │   ├── model_v1.pkl        # Trained ColumnTransformer + LogisticRegression pipeline
│   │   │   │   └── training_metrics.json # 5-fold CV & holdout test set evaluation metrics
│   │   │   ├── __init__.py
│   │   │   ├── explainer.py            # SHAP linear attribution engine
│   │   │   ├── predictor.py            # Model inference wrapper
│   │   │   └── train.py                # Pipeline training & artifact generation script
│   │   ├── models/                     # SQLAlchemy Relational Models
│   │   │   ├── __init__.py
│   │   │   ├── dataset.py              # Dataset model (multi-dataset quota)
│   │   │   ├── employee.py             # Employee model with JSON feature snapshots
│   │   │   ├── organization.py         # Multi-tenant Organization model
│   │   │   ├── prediction.py           # Prediction model (probability & risk level)
│   │   │   ├── prediction_explanation.py # SHAP factor attributions model
│   │   │   └── user.py                 # User account & credential model
│   │   ├── schemas/                    # Pydantic v2 Request/Response Schemas
│   │   │   ├── __init__.py
│   │   │   ├── ai.py
│   │   │   ├── analytics.py
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── dashboard.py
│   │   │   ├── dataset.py
│   │   │   ├── employee.py
│   │   │   ├── prediction.py
│   │   │   └── whatif.py
│   │   ├── services/                   # Business Logic Layer
│   │   │   ├── __init__.py
│   │   │   ├── ai_service.py
│   │   │   ├── analytics_service.py
│   │   │   ├── batch_service.py        # CSV batch ingestion & schema mapping
│   │   │   └── prediction_service.py   # Prediction & SHAP persistence orchestration
│   │   ├── utils/                      # Helper Utilities
│   │   │   ├── __init__.py
│   │   │   ├── config.py               # Pydantic BaseSettings & threshold configuration
│   │   │   ├── dataset_compatibility.py # Automated CSV schema compatibility analyzer
│   │   │   ├── feature_mapping.py      # Column normalizer & imputer mapping
│   │   │   └── sanitizer.py            # Recursive JSON sanitizer (NaN/Inf to None)
│   │   ├── __init__.py
│   │   └── main.py                     # FastAPI application factory & lifespan handler
│   ├── data/                           # Training Dataset Cache
│   │   └── WA_Fn-UseC_-HR-Employee-Attrition.csv # IBM HR Analytics dataset
│   ├── tests/                          # Automated Pytest Suite (29 Tests)
│   │   ├── __init__.py
│   │   ├── conftest.py                 # Async test fixtures & in-memory test DB
│   │   ├── test_ai.py                  # AI assistant response tests
│   │   ├── test_ai_chat.py             # Multi-turn chat & context injection tests
│   │   ├── test_auth.py                # Authentication, JWT & onboarding tests
│   │   ├── test_compat_check.py        # CSV schema compatibility tests
│   │   ├── test_datasets.py            # Dataset upload, isolation & quota tests
│   │   ├── test_employees.py           # Employee lookup & pagination tests
│   │   └── test_health.py              # Health check endpoint test
│   ├── Dockerfile                      # Backend container configuration
│   ├── pytest.ini                      # Pytest discovery settings
│   ├── requirements.txt                # Python package dependencies
│   ├── .env.example                    # Template backend environment variables
│   └── attrition.db                    # SQLite database file
│
├── frontend/                           # React + TypeScript + Vite Frontend
│   ├── src/                            # Frontend Source Code
│   │   ├── components/                 # Reusable UI Components
│   │   │   ├── DatasetSelector.tsx     # Global active dataset switcher
│   │   │   ├── LoadingSpinner.tsx      # Multi-size animated spinner
│   │   │   ├── RiskBadge.tsx           # Monochromatic & color-coded risk badges
│   │   │   └── StatCard.tsx            # KPI metric cards
│   │   ├── layouts/                    # Application Layout Wrappers
│   │   │   ├── AppLayout.tsx           # Main dashboard layout with sidebar & topbar
│   │   │   └── AuthLayout.tsx          # Authentication pages layout
│   │   ├── pages/                      # Page Views & Routes
│   │   │   ├── AiAssistantPage.tsx     # /ai-assistant chat interface
│   │   │   ├── AnalyticsPage.tsx       # /analytics workforce visualizations
│   │   │   ├── BatchPage.tsx           # /batch high-throughput scoring
│   │   │   ├── ContactPage.tsx         # /contact risk-stratified directory
│   │   │   ├── DashboardPage.tsx       # /dashboard executive command center
│   │   │   ├── DatasetManagerPage.tsx  # /datasets multi-dataset manager
│   │   │   ├── EmployeeSearchPage.tsx  # /employees profile search
│   │   │   ├── ForgotPasswordPage.tsx  # /forgot-password
│   │   │   ├── LandingPage.tsx         # / marketing landing page
│   │   │   ├── LoginPage.tsx           # /login
│   │   │   ├── OnboardingPage.tsx      # /onboarding organization setup
│   │   │   ├── PredictionPage.tsx      # /prediction individual risk scoring
│   │   │   ├── SignupPage.tsx          # /signup
│   │   │   └── WhatIfPage.tsx          # /what-if sensitivity simulator
│   │   ├── services/                   # Frontend API Clients (Axios)
│   │   │   ├── aiService.ts
│   │   │   ├── analyticsService.ts
│   │   │   ├── api.ts                  # Axios interceptors & base URL config
│   │   │   ├── authService.ts
│   │   │   ├── dashboardService.ts
│   │   │   ├── datasetService.ts
│   │   │   ├── employeeService.ts
│   │   │   ├── predictionService.ts
│   │   │   └── whatIfService.ts
│   │   ├── store/                      # Zustand Client State Stores
│   │   │   ├── aiStore.ts              # Chat messages & 24h localStorage TTL
│   │   │   ├── authStore.ts            # Auth tokens & session state
│   │   │   ├── batchStore.ts           # Batch CSV progress & results
│   │   │   ├── contactStore.ts         # Contact filters & pagination
│   │   │   ├── datasetStore.ts         # Multi-dataset list & active selection
│   │   │   ├── predictionStore.ts      # Single prediction form & SHAP outputs
│   │   │   ├── searchStore.ts          # Employee lookup search state
│   │   │   └── whatIfStore.ts          # What-If baseline & modified parameters
│   │   ├── types/                      # TypeScript Interface Definitions
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   ├── dataset.ts
│   │   │   ├── employee.ts
│   │   │   ├── index.ts
│   │   │   ├── prediction.ts
│   │   │   └── whatif.ts
│   │   ├── utils/                      # Formatting & Style Helpers
│   │   │   ├── cn.ts                   # clsx + tailwind-merge utility
│   │   │   └── formatters.ts           # Risk labels & probability formatters
│   │   ├── App.tsx                     # React Router 6 route declarations
│   │   ├── index.css                   # Global Tailwind CSS directives
│   │   ├── main.tsx                    # React DOM entry point
│   │   └── vite-env.d.ts
│   ├── index.html                      # HTML5 template
│   ├── package.json                    # Node dependencies & npm scripts
│   ├── postcss.config.js               # PostCSS configuration
│   ├── tailwind.config.js              # Tailwind CSS theme configuration
│   ├── tsconfig.json                   # TypeScript compiler configuration
│   └── vite.config.ts                  # Vite build settings & backend proxy
│
├── docker-compose.yml                  # Docker Compose orchestration
├── start_attritioniq.bat               # Windows one-click startup launcher
└── README.md                           # Project technical documentation
```

---

## 4. Requirements

Verify that your system meets the following prerequisites:

| Requirement | Minimum Version | Verified Working Version | Purpose |
|---|---|---|---|
| **Python** | 3.10+ | `3.12.5` | Backend runtime & ML pipeline execution |
| **Node.js** | 18.0+ | `20.18.0` / `22.x` | Frontend JavaScript runtime |
| **npm** | 9.0+ | `10.x` / `11.x` | Node package manager |
| **Git** | 2.30+ | `2.40+` | Version control |
| **Operating System** | Windows 10/11, macOS, or Linux | Windows 11 (64-bit) | Platform host |

---

## 5. Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/chinmaymeshram1-wq/AttritionIQ.git
cd AttritionIQ
```

---

### Step 2: Backend Setup

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create a dedicated Python virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows (Command Prompt):**
     ```cmd
     venv\Scripts\activate.bat
     ```
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS:**
     ```bash
     source venv/bin/activate
     ```

4. Install Python dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. Configure Backend Environment Variables:
   Copy `.env.example` to create `.env`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows Command Prompt: `copy .env.example .env`)*

   Configure key parameters in `.env`:
   ```ini
   APP_NAME="Employee Attrition Risk Intelligence System"
   DEBUG=False
   SECRET_KEY="your-secure-random-secret-key-here"
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   DATABASE_URL="sqlite+aiosqlite:///./attrition.db"
   MODEL_VERSION="v1"
   MODEL_ARTIFACT_PATH="app/ml/artifacts/model_v1.pkl"
   FEATURE_NAMES_PATH="app/ml/artifacts/feature_names.json"
   LOW_THRESHOLD=0.30
   HIGH_THRESHOLD=0.60
   GEMINI_API_KEY="your-google-gemini-api-key"
   GEMINI_MODEL="gemini-1.5-flash"
   ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
   TEST_USER_EMAIL="chinmay.test@example.com"
   TEST_USER_PASSWORD="TestPassword123!"
   ```

---

### Step 3: Frontend Setup

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

---

## 6. Database Setup

### Database Architecture & Initialization Flow

AttritionIQ uses an asynchronous **SQLite 3** relational database managed through **SQLAlchemy 2.0** with the **aiosqlite** driver. The database file is located at `backend/attrition.db`.

On application startup, FastAPI executes an automated `lifespan` initialization sequence:

```
FastAPI Application Startup
            │
            ▼
[Database Connection Established] (sqlite+aiosqlite:///./attrition.db)
            │
            ▼
[Schema Table Creation] (Base.metadata.create_all)
  - Creates: users, organizations, datasets, employees, predictions, prediction_explanations
            │
            ▼
[Safe Column Migration Check]
  - Verifies and applies missing schema columns (dataset_id, is_standalone)
            │
            ▼
[Seed Data Verification] (seed_initial_data)
  - Ensures default organization exists ("Acme Corporation")
  - Verifies/creates Primary Demo User (chinmay.test@example.com)
  - Verifies/creates Secondary Demo User (try123@example.com)
            │
            ▼
[Startup Complete] Backend begins serving incoming API requests
```

### Relational Schema Models

| Table Name | Model Class | Primary Key | Key Columns & Relationships |
|---|---|---|---|
| `organizations` | `Organization` | `id` (UUID) | `name`, `industry`, `employee_count_approx`. One-to-many with `users` and `datasets`. |
| `users` | `User` | `id` (UUID) | `email`, `hashed_password` (bcrypt), `full_name`, `is_active`, `is_admin`, `organization_id`. |
| `datasets` | `Dataset` | `id` (UUID) | `dataset_number` (1 to 7), `name`, `original_filename`, `status` (`PROCESSING`, `READY`, `FAILED`), `employee_count`, `organization_id`. |
| `employees` | `Employee` | `id` (UUID) | `employee_number`, `organization_id`, `dataset_id`, `feature_snapshot` (JSON audit trail), `created_at`. |
| `predictions` | `Prediction` | `id` (UUID) | `employee_id`, `employee_number`, `dataset_id`, `is_standalone` (bool), `attrition_probability` (float), `risk_level` (`LOW`/`MEDIUM`/`HIGH`), `model_version`, `input_features` (JSON). |
| `prediction_explanations` | `PredictionExplanation` | `id` (UUID) | `prediction_id`, `top_risk_factors` (JSON), `top_protective_factors` (JSON), `base_value` (float). |

---

## 7. Running the Application

### Option A — One-Click Start Script (Windows)

For Windows development, AttritionIQ includes a specialized startup batch script `start_attritioniq.bat` located in the project root:

1. Double-click `start_attritioniq.bat` or run it from Command Prompt:
   ```cmd
   start_attritioniq.bat
   ```
2. The script automatically:
   - Verifies the `backend` and `frontend` folders and Python virtual environment.
   - Detects `node` and `npm` in system paths.
   - Launches the FastAPI backend with Uvicorn on **`http://localhost:8000`**.
   - Launches the Vite frontend development server on **`http://localhost:3000`**.
   - Opens your default web browser directly to **`http://localhost:3000`**.

To stop the servers, close the two opened terminal windows.

---

### Option B — Manual Startup

#### 1. Start the Backend:
```bash
cd backend
# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

uvicorn app.main:app --reload --port 8000
```
- API Base URL: **`http://localhost:8000`**
- Interactive Swagger Documentation: **`http://localhost:8000/docs`**
- Alternative Redoc Documentation: **`http://localhost:8000/redoc`**

#### 2. Start the Frontend:
```bash
cd frontend
npm run dev
```
- Web Application URL: **`http://localhost:3000`**

---

## 8. Authentication

AttritionIQ uses an industry-standard OAuth2 password authentication flow with signed **JSON Web Tokens (JWT)** using the HS256 algorithm and bcrypt password hashing.

### Authentication Flow Diagram

```
User enters Email & Password
              │
              ▼
Frontend sends POST /auth/login (JSON or form-data payload)
              │
              ▼
Backend normalizes email (lowercase & stripped)
              │
              ▼
Query User record in database
              │
    ┌─────────┴─────────┐
    ▼                   ▼
[User Found]     [User Not Found]
    │                   │
    ▼                   ▼
Verify Bcrypt Hash  HTTP 401 "Invalid email or password"
    │
    ├───────────────────┐
    ▼                   ▼
[Hash Matches]   [Hash Mismatch]
    │                   │
    ▼                   ▼
Check is_active    HTTP 401 "Invalid email or password"
    │
    ├───────────────────┐
    ▼                   ▼
[is_active = True] [is_active = False]
    │                   │
    ▼                   ▼
Generate Signed JWT HTTP 401 "Account is inactive. Please contact support."
Bearer Token (HS256)
    │
    ▼
HTTP 200 Response with TokenResponse Schema
(access_token, user_id, full_name, email, organization_id, organization_name)
    │
    ▼
Frontend stores auth state in Zustand store & localStorage
    │
    ▼
Redirect to /dashboard
```

---

## 9. Demo Accounts

The database seed module automatically provisions verified demo accounts on application startup for evaluation and testing:

> **Important Note:** These credentials are for local development, academic review, and testing purposes only. Sensitive production secrets (JWT secret keys, database passwords, Gemini API keys) are not committed to source control and are loaded securely via `.env`.

| Parameter | Primary Demo Account | Secondary Demo Account |
|---|---|---|
| **Email** | `chinmay.test@example.com` | `try123@example.com` |
| **Password** | `TestPassword123!` | `try@123` |
| **Full Name** | Chinmay Test | Demo User |
| **Role** | Administrator | Standard Demo User |
| **Default Organization** | Acme Corporation | Acme Corporation |

---

## 10. Dataset Manager

The **Dataset Manager** (`/datasets`) provides a centralized, multi-dataset management architecture supporting up to **7 concurrent datasets** per organization.

```
┌─────────────────────────────────────────────────────────────┐
│                 Dataset Manager Workflow                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
            User navigates to /datasets & selects CSV
                               │
                               ▼
                   uploadDataset(file) called
                               │
                               ▼
                     uploading state = true
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Real-Time Loading Banner                  │
│  "Dataset is loading. Please wait 2–3 minutes while we      │
│   process your file."                                       │
│  "Please don't refresh or close this page while the dataset │
│   is being processed."                                      │
│  "If an error appears, please refresh the page and try again"│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
               Button text: "Processing CSV..."
                               │
                               ▼
                 POST /datasets/upload (Multipart)
                               │
                               ▼
            Backend creates Dataset record (status="PROCESSING")
                               │
                               ▼
            BatchService parses CSV & runs ML predictions
                               │
                               ▼
            Employees & Predictions linked to dataset_id
                               │
                               ▼
            Dataset record updated (status="READY", count=N)
                               │
                               ▼
                     uploading state = false
                               │
                               ▼
       Banner dismisses & Dataset Card appears in list
```

### Key Dataset Manager Features
- **Deterministic Quota (Max 7 Datasets):** Strictly enforces a limit of 7 datasets per organization. Attempts to upload an 8th dataset return a clear error prompting the user to delete an existing dataset.
- **Automatic Numbering & Recycling:** Datasets are assigned the lowest available number between 1 and 7 (e.g., `Dataset 01`, `Dataset 02`). Deleting `Dataset 02` frees slot 2 for the next upload.
- **Isolated Multi-Dataset Context:** Each dataset maintains completely isolated employee records, prediction scores, and analytics. Switching the active dataset in the global `DatasetSelector` instantly updates the entire application view.
- **Cascade Deletion:** Deleting a dataset cleanly purges all associated employee records, predictions, and SHAP explanation records in foreign key order without leaving orphan records.

---

## 11. CSV → Employee Data → Prediction Flow

```
Raw CSV File Uploaded
          │
          ▼
[analyze_csv_compatibility(df)]
          │
          ├───────────────────────────────┬──────────────────────────────┐
          ▼                               ▼                              ▼
  FULLY_COMPATIBLE              PARTIALLY_COMPATIBLE                INCOMPATIBLE
  All 30 features found         >= 15 canonical features found      < 15 canonical features
  Direct column mapping         Missing features set to NaN         Upload rejected with
                                SimpleImputer imputes medians       detailed error report
                                Flagged: is_estimated = True
          │                               │
          └───────────────────────────────┘
                          │
                          ▼
            [Employee Identifier Extraction]
            Resolves: EmployeeNumber, Employee_ID, EmpID, etc.
                          │
                          ▼
            [Feature Transformation Pipeline]
            ColumnTransformer:
              • Numerical: SimpleImputer(median) -> StandardScaler()
              • Categorical: SimpleImputer(most_frequent) -> OneHotEncoder()
                          │
                          ▼
            [Logistic Regression Classification]
            Probability: p = P(Attrition = 1 | X)  [0.0 to 1.0]
                          │
                          ▼
            [Risk Level Classification]
            p < 0.30 -> LOW  |  0.30 <= p < 0.60 -> MEDIUM  |  p >= 0.60 -> HIGH
                          │
                          ▼
            [SHAP Linear Attribution Calculation]
            phi_i = w_i * x_transformed_i
            Ranks: Top Risk-Elevating Factors & Top Protective Factors
                          │
                          ▼
            [Relational Database Persistence]
            Stores Employee, Prediction, and PredictionExplanation records
```

### Canonical 30 Feature Schema

| Category | Features |
|---|---|
| **Demographics & Personal** | `Age`, `Gender`, `MaritalStatus`, `Education`, `EducationField`, `DistanceFromHome` |
| **Role & Work Environment** | `Department`, `JobRole`, `JobLevel`, `BusinessTravel`, `OverTime` (mapped to `over_time`) |
| **Compensation & Financial** | `MonthlyIncome`, `PercentSalaryHike`, `StockOptionLevel`, `HourlyRate`, `DailyRate`, `MonthlyRate` |
| **Tenure & Career History** | `TotalWorkingYears`, `YearsAtCompany`, `YearsInCurrentRole`, `YearsSinceLastPromotion`, `YearsWithCurrManager`, `NumCompaniesWorked` |
| **Satisfaction & Performance** | `JobSatisfaction`, `EnvironmentSatisfaction`, `RelationshipSatisfaction`, `WorkLifeBalance`, `JobInvolvement`, `TrainingTimesLastYear`, `PerformanceRating` |

---

## 12. Risk Classification

Attrition risk levels are computed directly from the model's output probability $p$ using configurable threshold settings defined in `app/utils/config.py`:

```python
LOW_THRESHOLD = 0.30   # 30%
HIGH_THRESHOLD = 0.60  # 60%
```

### Decision Logic

```
IF probability < 0.30 (30%):
    Risk Level = "LOW"
    Status: Stable retention profile. Standard career development and engagement.

ELSE IF 0.30 <= probability < 0.60 (30% to 59.9%):
    Risk Level = "MEDIUM"
    Status: Moderate turnover risk. Monitor job satisfaction, workload, and promotion timelines.

ELSE (probability >= 0.60):
    Risk Level = "HIGH"
    Status: Critical turnover risk. Immediate retention intervention and manager review recommended.
```

---

## 13. Contact Intelligence

The **Contact Intelligence** module (`/contact`) bridges predictive analytics with HR engagement by providing a risk-stratified workforce directory.

### Supported Fields & Aliases
The module extracts contact and identity fields from uploaded datasets using flexible alias resolution:

- **Employee ID:** `EmployeeNumber`, `EmployeeID`, `EmpID`, `Employee_ID`, `EmpNo`
- **Name:** `Name`, `EmployeeName`, `FullName`
- **Email:** `Email`, `EmailAddress`, `WorkEmail`
- **Phone:** `Phone`, `PhoneNumber`, `Mobile`, `MobileNumber`, `ContactNumber`
- **Address / Location:** `Address`, `EmployeeAddress`, `HomeAddress`, `Location`, `City`
- **Department & Job Role:** `Department`, `JobRole`, `Role`, `Title`, `Position`
- **Risk Level & Probability:** Dynamically mapped from the latest model prediction.

### Missing Data Handling & Integrity Rules
- **No Synthetic Hallucination:** The application strictly surfaces real data from the uploaded CSV and never invents or hallucinates fake emails, phone numbers, or addresses.
- **Clean Fallback Rendering:** If a contact field is absent, empty, `NaN`, or `null` in the uploaded dataset, the UI displays a clean fallback dash (`—`).
- **Productivity Actions:** Email and phone entries feature 1-click clipboard copy buttons with visual confirmation feedback.
- **Risk-Based Filtering:** Dedicated filter buttons for `ALL`, `HIGH`, `MEDIUM`, and `LOW` allow HR teams to instantly focus on high-risk personnel requiring outreach.

---

## 14. Other Application Modules

### Dashboard Command Center (`/dashboard`)
The central landing hub for logged-in users. Displays six primary KPI metric cards, an active background operations tracker, a workforce risk distribution breakdown, real-time system component health checks, quick action shortcuts, and a safe demo reset control.

### Employee Search (`/employees`)
Enables direct lookup of individual employee records within the active dataset. Provides complete feature tables, historical prediction dates, probability meters, risk badges, and SHAP factor rankings.

### Individual Prediction (`/prediction`)
A structured 30-parameter scoring interface. Users can input hypothetical or single employee attributes to evaluate instant attrition probability, view SHAP attributions, and export parameter sets directly to What-If or the AI Assistant.

### Batch Prediction (`/batch`)
A dedicated high-throughput scoring interface for ad-hoc CSV files. Generates compatibility diagnostic summaries and searchable, filterable result tables with CSV download capabilities.

### Analytics (`/analytics`)
Aggregated workforce analytics presenting four executive charts:
1. *Overall Risk Tier Distribution* (Donut chart with exact counts and proportions).
2. *Overtime Status Risk Comparison* (Comparative mean probabilities for overtime vs. non-overtime cohorts).
3. *Departmental Risk Breakdown* (Grouped bars across R&D, Sales, and HR).
4. *Attrition Count by Job Role* (Horizontal stacked bar chart with full role labels).

### What-If Analysis (`/what-if`)
A decision-support simulation workspace. Adjust salary hikes, overtime mandates, stock option allocations, and satisfaction scores to evaluate real-time risk deltas:
$$\Delta p = p_{\text{modified}} - p_{\text{baseline}}$$

### AI HR Assistant (`/ai-assistant`)
An interactive chat assistant powered by Google Gemini 1.5 Flash. Translates statistical risk scores and SHAP factors into actionable retention strategies while enforcing prompt guardrails that prevent punitive advice or automated termination suggestions. Conversations persist in browser storage with an automatic 24-hour TTL.

---

## 15. API Overview

All authenticated endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Tag | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Authentication | Register new user and organization |
| `POST` | `/auth/login` | Authentication | Authenticate user and issue JWT bearer token |
| `POST` | `/auth/forgot-password` | Authentication | Password reset placeholder |
| `POST` | `/auth/onboarding` | Authentication | Complete organization onboarding setup |
| `GET` | `/datasets` | Dataset Manager | List all datasets for organization (max 7) |
| `POST` | `/datasets/upload` | Dataset Manager | Upload CSV dataset, run batch ML scoring & import |
| `GET` | `/datasets/{dataset_id}` | Dataset Manager | Retrieve single dataset metadata |
| `DELETE` | `/datasets/{dataset_id}` | Dataset Manager | Cascade delete dataset, employees, and predictions |
| `GET` | `/employees` | Employees | Paginated employee list with optional risk scores |
| `GET` | `/employees/{employee_number}` | Employees | Single employee details, prediction & SHAP factors |
| `POST` | `/employees/search/analyze` | Employees | Generate CSV compatibility analysis report |
| `POST` | `/employees/search` | Employees | Search employee by ID within uploaded CSV |
| `POST` | `/prediction/individual` | Prediction | Real-time single-employee prediction with SHAP |
| `POST` | `/prediction/batch` | Prediction | Batch prediction on uploaded CSV file |
| `POST` | `/what-if/simulate` | What-If | Simulate parameter modifications & risk delta ($\Delta p$) |
| `GET` | `/analytics/overview` | Analytics | Overall risk distributions & workforce metrics |
| `GET` | `/analytics/overtime` | Analytics | Comparative risk metrics by overtime status |
| `GET` | `/analytics/departments` | Analytics | Departmental risk breakdown |
| `GET` | `/analytics/job-roles` | Analytics | Job-role risk breakdown |
| `GET` | `/dashboard/summary` | Dashboard | Command center KPI summaries & active jobs |
| `POST` | `/dashboard/reset-demo` | Dashboard | Safely purge demo prediction data |
| `POST` | `/ai/chat` | AI Assistant | Multi-turn retention advice powered by Gemini |
| `GET` | `/health` | Health | Service status and ML model version |

---

## 16. Machine Learning & Explainability

### Supervised Classification Pipeline

AttritionIQ uses an optimized **Logistic Regression** pipeline with balanced class weighting:

- **Pipeline Architecture:** `ColumnTransformer` + `LogisticRegression`
- **Class Weighting:** `{0: 1, 1: 2}` to address the minority `Attrition=Yes` class distribution.
- **Regularization:** $L_2$ regularization with inverse penalty $C = 0.1$ and `lbfgs` solver.
- **Numerical Preprocessing (23 features):** `SimpleImputer(strategy="median")` followed by `StandardScaler()`.
- **Categorical Preprocessing (7 features):** `SimpleImputer(strategy="most_frequent")` followed by `OneHotEncoder(handle_unknown="ignore", sparse_output=False)`.

### Verified Model Performance Metrics

Evaluated on the hold-out test set ($N = 294$, 20% stratified test set):

| Metric | 5-Fold Stratified CV (Mean $\pm$ Std) | Hold-Out Test Set ($N=294$) |
|---|---|---|
| **ROC-AUC** | $0.8359 \pm 0.0307$ | **$0.8140$** |
| **PR-AUC (Average Precision)** | $0.6466 \pm 0.0560$ | **$0.5984$** |
| **F1-Score** | $0.6098 \pm 0.0426$ | **$0.5301$** |
| **Precision** | $0.6446 \pm 0.0412$ | **$0.6111$** |
| **Recall** | $0.5842 \pm 0.0714$ | **$0.4681$** |

### Local Explainability via Linear SHAP

The `AttritionExplainer` computes exact feature contributions $\phi_i$ for each inference:
$$\phi_i = w_i \cdot x_{\text{transformed}, i}$$
where $w_i$ represents the trained model coefficient for feature $i$.
- **Risk Elevating Factors ($\phi_i > 0$):** Attributes that increase attrition probability (e.g., `Overtime: Yes`, `Distance From Home: High`, `Low Job Involvement`).
- **Protective Factors ($\phi_i < 0$):** Attributes that reduce attrition probability (e.g., `High Monthly Income`, `High Job Satisfaction`, `Stock Option Level: 1+`).

---

## 17. Testing

AttritionIQ maintains a comprehensive test suite across the backend and frontend.

### Backend Automated Test Suite (Pytest)

Run backend unit and integration tests from the `backend/` directory:

```bash
cd backend
.\venv\Scripts\python.exe -m pytest tests
```

**Verified Test Result: 29 passed** (0 failed)

```
tests/test_ai.py ..........                                              [ 3%]
tests/test_ai_chat.py ................................................... [ 24%]
tests/test_auth.py ...................................................... [ 44%]
tests/test_compat_check.py .............................................. [ 48%]
tests/test_datasets.py .................................................. [ 82%]
tests/test_employees.py ................................................. [ 96%]
tests/test_health.py .................................................... [100%]

============================== 29 passed in 48.28s ==============================
```

### Frontend Production Build Verification

Verify frontend TypeScript compilation and Vite bundling:

```bash
cd frontend
npm run build
```

**Verified Build Result:**
- **0 TypeScript errors**
- **0 build errors**
- Production bundle successfully generated in `dist/`.

---

## 18. Security & Data Handling

- **Password Security:** Passwords are never stored in plaintext. They are hashed using `bcrypt` via Passlib.
- **Stateless JWT Authentication:** Access tokens are signed using HS256 with configurable expiry (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Route Protection:** Protected API endpoints enforce dependency injection via `get_current_active_user`.
- **Multi-Tenant Isolation:** Dataset, employee, and prediction records are scoped to `organization_id`.
- **Safe Administrative Controls:** The demo reset endpoint clears prediction records without dropping user accounts, corrupting database tables, or modifying ML weights.
- **Responsible AI Guardrails:** System prompts for Gemini 1.5 Flash strictly instruct the model to provide retention, engagement, and career development advice while refusing requests for punitive actions or automated termination.

---

## 19. Deployment

AttritionIQ is production-ready for deployment to cloud platforms such as **Render**, **Railway**, or **AWS**:

### Docker Deployment
The repository includes a backend `Dockerfile` and root `docker-compose.yml`:

```bash
docker-compose up --build
```

### Render Deployment
1. **Backend Web Service:**
   - Environment: Python 3.12
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (working directory: `backend`)
2. **Frontend Static Site:**
   - Build Command: `npm install && npm run build` (working directory: `frontend`)
   - Publish Directory: `frontend/dist`

```
Live Demo URL:
<ADD FINAL RENDER URL HERE>
```

---

## 20. Demo Workflow

For reviewers, teachers, or evaluators exploring AttritionIQ for the first time:

1. **Launch the Application:** Run `start_attritioniq.bat` or start the servers manually.
2. **Log In:** Navigate to `http://localhost:3000/login` and enter the primary demo credentials:
   - Email: `chinmay.test@example.com`
   - Password: `TestPassword123!`
3. **Explore the Dashboard:** Review the primary workforce KPI StatCards, risk distribution breakdown, and system component health checks.
4. **Open Dataset Manager:** Navigate to **Dataset Manager** (`/datasets`).
5. **Upload a Dataset:** Click **Upload Dataset** and select an HR CSV file (e.g., `backend/data/WA_Fn-UseC_-HR-Employee-Attrition.csv`).
6. **Observe the Processing State:** Note the real-time processing banner:
   *"Dataset is loading. Please wait 2–3 minutes while we process your file."*
7. **Switch Active Dataset:** In the global topbar **DatasetSelector**, select `Dataset 01`.
8. **View Employees:** Navigate to **Employee Search** (`/employees`) or **Contact Intelligence** (`/contact`).
9. **Inspect Contact Intelligence:** Filter by `HIGH RISK` to inspect critical employees, copy email/phone details with 1 click, and review real contact attributes.
10. **Analyze Organizational Trends:** Open **Analytics** (`/analytics`) to explore overtime impact and departmental risk charts.
11. **Run a What-If Scenario:** Open **What-If Analysis** (`/what-if`), reduce overtime or increase compensation hikes, and observe the immediate risk delta ($\Delta p$).
12. **Chat with AI Assistant:** Open **AI HR Assistant** (`/ai-assistant`) to ask for a customized retention strategy for a specific employee.

---

## 21. Troubleshooting

### 1. Port 8000 or 3000 Already in Use (Windows)
If port 8000 (backend) or 3000 (frontend) is already allocated:
```cmd
netstat -ano | findstr :8000
taskkill /PID <PID> /F

netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 2. Python Virtual Environment Issues
Ensure you run commands using the virtual environment's Python binary:
```cmd
cd backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3. Node.js / npm Not Detected
Ensure Node.js is in your system `PATH`. Default Windows installation paths:
`C:\Program Files\nodejs` or `%LOCALAPPDATA%\Programs\nodejs`.

### 4. Database Reset / Lock Issues
If `attrition.db` becomes locked by another process:
1. Stop running backend servers.
2. Delete `backend/attrition.db`.
3. Restart the backend server; the database, schema, and demo accounts will automatically re-initialize.

### 5. Stale Browser Bundle or Cache
If UI changes are not reflecting:
- Perform a hard refresh in the browser (`Ctrl + F5` or `Ctrl + Shift + R`).
- Clear Vite build cache: `rm -rf frontend/node_modules/.vite` and restart `npm run dev`.

---

## 22. Project Status

- **Backend Test Suite:** **29 passed** (100% passing rate)
- **Frontend Production Build:** **Verified** (0 TypeScript errors, 0 build errors)
- **Multi-Dataset Architecture:** **Verified** (supports up to 7 datasets per organization with cascade deletion)
- **Contact Intelligence:** **Verified** (flexible alias resolution, 1-click copying, zero synthetic data)
- **Authentication & Seeding:** **Verified** (dual demo accounts seeded automatically on startup)
- **Multi-Browser Verification:** **Tested & Verified** across modern Chromium and WebKit browsers.

---

## 23. License

Licensing information is not currently specified in this repository. All rights are reserved by the author.

---

## 24. Author & Repository Information

- **Author:** Chinmay Meshram
- **GitHub Remote:** [https://github.com/chinmaymeshram1-wq/AttritionIQ.git](https://github.com/chinmaymeshram1-wq/AttritionIQ.git)
- **Project Name:** AttritionIQ
