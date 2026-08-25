// ── Auth ───────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  full_name: string
  email: string
  organization_name: string
  password: string
  confirm_password: string
}

export interface OnboardingRequest {
  organization_name: string
  industry?: string
  employee_count_approx?: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user_id: string
  full_name: string
  email: string
  organization_id: string | null
  organization_name: string | null
}

// ── Prediction ─────────────────────────────────────────────────────────────────
export interface PredictionRequest {
  employee_number: number
  age: number
  gender: string
  marital_status: string
  education: number
  education_field: string
  department: string
  job_role: string
  job_level: number
  business_travel: string
  overtime: string
  monthly_income: number
  percent_salary_hike: number
  stock_option_level: number
  total_working_years: number
  years_at_company: number
  years_in_current_role: number
  years_since_last_promotion: number
  years_with_curr_manager: number
  num_companies_worked: number
  job_satisfaction: number
  environment_satisfaction: number
  relationship_satisfaction: number
  work_life_balance: number
  job_involvement: number
  distance_from_home: number
  hourly_rate: number
  daily_rate: number
  monthly_rate: number
  training_times_last_year: number
  performance_rating: number
}

export interface ShapFactor {
  feature: string
  display_name: string
  shap_value: number
  feature_value: unknown
}

export interface PredictionExplanation {
  top_risk_factors: ShapFactor[]
  top_protective_factors: ShapFactor[]
  base_value: number
}

export interface PredictionResponse {
  prediction_id: string
  employee_number: number
  attrition_probability: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  model_version: string
  explanation?: PredictionExplanation
  predicted_at: string
}

export interface BatchPredictionRecord {
  employee_number: number
  attrition_probability: number
  risk_level: string
  prediction_id: string
  is_estimated: boolean
}

export interface BatchValidationError {
  row: number
  employee_number: number | null
  errors: string[]
}

export interface CompatibilityReport {
  status: 'FULLY_COMPATIBLE' | 'PARTIALLY_COMPATIBLE' | 'INCOMPATIBLE'
  features_found: number
  features_required: number
  data_completeness_percentage: number
  mapped_columns: Record<string, string>       // upload_col → canonical_name
  mapping_confidence: Record<string, number>   // canonical_name → confidence
  mapping_method: Record<string, string>       // canonical_name → method
  missing_features: string[]
  unrecognized_columns: string[]
  employee_id_column: string | null
  is_estimated: boolean
  estimated_prediction_safe: boolean
}

export interface BatchPredictionResponse {
  total_rows: number
  successful: number
  failed: number
  validation_errors: BatchValidationError[]
  results: BatchPredictionRecord[]
  compatibility_report?: CompatibilityReport
}

// ── Analytics ──────────────────────────────────────────────────────────────────
export interface DashboardSummary {
  total_employees_analyzed: number
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  average_attrition_probability: number
  total_predictions: number
}

// ── AI Chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  predictionContext?: {
    employee_number: number
    attrition_probability: number
    risk_level: string
    top_risk_factors?: ShapFactor[]
    top_protective_factors?: ShapFactor[]
  }
}

export interface ChatRequest {
  message: string
  employee_context?: {
    employee_number: number
    department?: string
    job_role?: string
    age?: number
    years_at_company?: number
    overtime?: string
    job_satisfaction?: number
    work_life_balance?: number
  }
  prediction_context?: {
    attrition_probability: number
    risk_level: string
    top_risk_factors?: ShapFactor[]
    top_protective_factors?: ShapFactor[]
  }
  conversation_history?: { role: string; content: string }[]
}

export interface ChatResponse {
  reply: string
  model_used: string
}

// ── What-If ────────────────────────────────────────────────────────────────────
export interface WhatIfRequest {
  original: PredictionRequest
  modified: PredictionRequest
}

export interface WhatIfResponse {
  original_probability: number
  modified_probability: number
  difference: number
  original_risk_level: string
  modified_risk_level: string
  model_version: string
}

// ── Employee Search (CSV-upload-first) ────────────────────────────────────────
export interface DatasetCompatibilitySummary {
  status: 'FULLY_COMPATIBLE' | 'PARTIALLY_COMPATIBLE' | 'INCOMPATIBLE'
  features_found: number
  features_required: number
  data_completeness_percentage: number
}

export interface DatasetAnalysisResult {
  row_count: number
  column_count: number
  employee_id_column: string | null
  columns: string[]
  compatibility: DatasetCompatibilitySummary
}

export interface StoredPrediction {
  id: string
  attrition_probability: number
  risk_level: string
  model_version: string
  created_at: string
}

export interface StoredExplanation {
  top_risk_factors: ShapFactor[]
  top_protective_factors: ShapFactor[]
  base_value: number
}

export interface EmployeeSearchResult {
  employee_row: Record<string, unknown>
  employee_id_column: string
  dataset_info: { row_count: number }
  compatibility: DatasetCompatibilitySummary
  stored_prediction: StoredPrediction | null
  explanation: StoredExplanation | null
}
