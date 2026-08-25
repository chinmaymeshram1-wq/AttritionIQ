import shap
import numpy as np
import pandas as pd
import joblib
from dataclasses import dataclass
from typing import List, Dict, Any
from app.utils.config import settings
from app.schemas.prediction import ShapFactor


@dataclass
class ExplanationResult:
    top_risk_factors: List[ShapFactor]
    top_protective_factors: List[ShapFactor]
    base_value: float


# Human-readable display names for internal feature keys
DISPLAY_NAMES: Dict[str, str] = {
    "age": "Age",
    "gender": "Gender",
    "marital_status": "Marital Status",
    "education": "Education Level",
    "education_field": "Education Field",
    "department": "Department",
    "job_role": "Job Role",
    "job_level": "Job Level",
    "business_travel": "Business Travel",
    "overtime": "Overtime",
    "over_time": "Overtime",
    "monthly_income": "Monthly Income",
    "percent_salary_hike": "Salary Hike %",
    "stock_option_level": "Stock Option Level",
    "total_working_years": "Total Working Years",
    "years_at_company": "Years at Company",
    "years_in_current_role": "Years in Current Role",
    "years_since_last_promotion": "Years Since Promotion",
    "years_with_curr_manager": "Years with Manager",
    "num_companies_worked": "Companies Worked",
    "job_satisfaction": "Job Satisfaction",
    "environment_satisfaction": "Environment Satisfaction",
    "relationship_satisfaction": "Relationship Satisfaction",
    "work_life_balance": "Work-Life Balance",
    "job_involvement": "Job Involvement",
    "distance_from_home": "Distance from Home",
    "hourly_rate": "Hourly Rate",
    "daily_rate": "Daily Rate",
    "monthly_rate": "Monthly Rate",
    "training_times_last_year": "Training Times Last Year",
    "performance_rating": "Performance Rating",
}


class AttritionExplainer:
    """Computes SHAP values for the Logistic Regression pipeline."""

    def __init__(self, model_path: str):
        pipeline = joblib.load(model_path)
        self.preprocessor = pipeline.named_steps["preprocessor"]
        self.classifier = pipeline.named_steps["classifier"]
        self._shap_explainer = None

    def _prepare_features(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Map public API feature names to internal ML pipeline column names."""
        feat = dict(features)
        if "overtime" in feat and "over_time" not in feat:
            feat["over_time"] = feat.pop("overtime")
        return feat

    def _extract_feature_value_and_display(
        self, clean_name: str, features: Dict[str, Any]
    ) -> tuple[Any, str]:
        """Derive the original input feature value and a clean display name."""
        # 1. Direct match (numerical features e.g. age, monthly_income)
        if clean_name in features:
            val = features[clean_name]
            display = DISPLAY_NAMES.get(clean_name, clean_name.replace("_", " ").title())
            return val, display

        if clean_name == "over_time" and "overtime" in features:
            return features["overtime"], "Overtime"
        if clean_name == "overtime" and "over_time" in features:
            return features["over_time"], "Overtime"

        # 2. General categorical one-hot encoded match (e.g. over_time_Yes, department_Research & Development)
        all_keys = list(features.keys())
        if "over_time" not in all_keys and "overtime" in features:
            all_keys.append("over_time")
        all_keys.sort(key=len, reverse=True)

        for k in all_keys:
            prefix = f"{k}_"
            if clean_name.startswith(prefix):
                category_suffix = clean_name[len(prefix):]
                actual_val = features.get(
                    k, features.get("overtime" if k == "over_time" else k, category_suffix)
                )
                base_display = DISPLAY_NAMES.get(k, k.replace("_", " ").title())
                display = f"{base_display}: {category_suffix}"
                return actual_val, display

        display = DISPLAY_NAMES.get(clean_name, clean_name.replace("_", " ").title())
        return features.get(clean_name, None), display

    def explain(
        self, features: Dict[str, Any], probability: float, top_n: int = 5
    ) -> ExplanationResult:
        prepared = self._prepare_features(features)
        df = pd.DataFrame([prepared])
        X_transformed = self.preprocessor.transform(df)

        # Linear model feature contributions: coefficient * transformed_feature
        coefs = self.classifier.coef_[0]
        transformed_row = (
            X_transformed[0]
            if isinstance(X_transformed, np.ndarray)
            else X_transformed.toarray()[0]
        )
        contributions = coefs * transformed_row

        # Model intercept as baseline log-odds
        base_value = float(self.classifier.intercept_[0])

        try:
            feature_names_out = self.preprocessor.get_feature_names_out()
        except Exception:
            feature_names_out = [f"feature_{i}" for i in range(len(contributions))]

        all_factors: List[ShapFactor] = []
        for feat_name, c_val in zip(feature_names_out, contributions):
            if c_val == 0.0:
                continue

            # Strip ColumnTransformer prefix (e.g. "num__age" -> "age", "cat__over_time_Yes" -> "over_time_Yes")
            clean_name = feat_name.split("__")[-1]
            feat_val, display = self._extract_feature_value_and_display(clean_name, features)

            factor = ShapFactor(
                feature=clean_name,
                display_name=display,
                shap_value=round(float(c_val), 4),
                feature_value=feat_val,
            )
            all_factors.append(factor)

        # Risk factors: positive contributions (elevating risk), sorted by magnitude descending
        positive_factors = [f for f in all_factors if f.shap_value > 0]
        positive_factors.sort(key=lambda x: x.shap_value, reverse=True)
        top_risk_factors = positive_factors[:top_n]

        # Protective factors: negative contributions (reducing risk), sorted by absolute magnitude descending
        negative_factors = [f for f in all_factors if f.shap_value < 0]
        negative_factors.sort(key=lambda x: abs(x.shap_value), reverse=True)
        top_protective_factors = negative_factors[:top_n]

        return ExplanationResult(
            top_risk_factors=top_risk_factors,
            top_protective_factors=top_protective_factors,
            base_value=base_value,
        )


_explainer_instance: AttritionExplainer = None


def get_explainer() -> AttritionExplainer:
    """Singleton — load explainer once on first call."""
    global _explainer_instance
    if _explainer_instance is None:
        _explainer_instance = AttritionExplainer(model_path=settings.MODEL_ARTIFACT_PATH)
    return _explainer_instance
