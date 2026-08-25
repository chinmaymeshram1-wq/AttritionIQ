import joblib
import numpy as np
import pandas as pd
import json
import os
from typing import Dict, Any
from app.utils.config import settings


class AttritionPredictor:
    """Wraps the saved sklearn pipeline and exposes a clean predict API."""

    def __init__(self, model_path: str, feature_names_path: str):
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model artifact not found at '{model_path}'. "
                "Please run: python -m app.ml.train  (from the backend/ directory)"
            )
        self.pipeline = joblib.load(model_path)
        with open(feature_names_path, "r") as f:
            self.feature_names: list = json.load(f)

    def _prepare_features(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Map public API feature names to internal ML pipeline column names."""
        feat = dict(features)
        if "overtime" in feat and "over_time" not in feat:
            feat["over_time"] = feat.pop("overtime")
        return feat

    def _to_dataframe(self, features: Dict[str, Any]) -> pd.DataFrame:
        """Convert feature dict to a single-row DataFrame with exact ML feature names."""
        prepared = self._prepare_features(features)
        return pd.DataFrame([prepared])

    def predict_proba(self, features: Dict[str, Any]) -> float:
        """Return the estimated probability of attrition (class=1)."""
        df = self._to_dataframe(features)
        proba = self.pipeline.predict_proba(df)[0][1]
        return float(proba)

    def predict_proba_batch(self, features_list: list) -> np.ndarray:
        """Return probabilities for a list of feature dicts."""
        prepared = [self._prepare_features(f) for f in features_list]
        df = pd.DataFrame(prepared)
        return self.pipeline.predict_proba(df)[:, 1]


_predictor_instance: AttritionPredictor = None


def get_predictor() -> AttritionPredictor:
    """Singleton — load model once on first call."""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = AttritionPredictor(
            model_path=settings.MODEL_ARTIFACT_PATH,
            feature_names_path=settings.FEATURE_NAMES_PATH,
        )
    return _predictor_instance
