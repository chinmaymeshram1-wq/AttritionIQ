from sqlalchemy.ext.asyncio import AsyncSession
from app.ml.predictor import get_predictor
from app.ml.explainer import get_explainer
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.schemas.prediction import (
    IndividualPredictionRequest,
    PredictionResponse,
    PredictionExplanationSchema,
)
from app.utils.config import settings
from datetime import datetime, timezone
import uuid


class PredictionService:
    def __init__(self, db: AsyncSession = None):
        self.db = db
        self.predictor = get_predictor()
        self.explainer = get_explainer()

    def predict_probability(self, features: dict) -> float:
        """Run ML pipeline on a feature dict and return attrition probability."""
        return self.predictor.predict_proba(features)

    async def predict_individual(self, request: IndividualPredictionRequest) -> PredictionResponse:
        """Full pipeline: validate → predict → SHAP explain → persist standalone prediction."""
        features = request.model_dump(exclude={"employee_number"})

        probability = self.predictor.predict_proba(features)
        risk_level = settings.get_risk_level(probability)
        explanation_data = self.explainer.explain(features, probability)

        # Standalone employee record (not associated with any imported dataset)
        employee = Employee(
            id=str(uuid.uuid4()),
            employee_number=request.employee_number,
            dataset_id=None,
            feature_snapshot=request.model_dump(),
        )
        self.db.add(employee)
        await self.db.flush()

        # Standalone prediction (is_standalone=True)
        prediction_id = str(uuid.uuid4())
        prediction = Prediction(
            id=prediction_id,
            employee_id=employee.id,
            employee_number=request.employee_number,
            dataset_id=None,
            is_standalone=True,
            attrition_probability=probability,
            risk_level=risk_level,
            model_version=settings.MODEL_VERSION,
            input_features=features,
        )
        self.db.add(prediction)
        await self.db.flush()

        exp_record = PredictionExplanation(
            id=str(uuid.uuid4()),
            prediction_id=prediction_id,
            top_risk_factors=[f.model_dump() for f in explanation_data.top_risk_factors],
            top_protective_factors=[f.model_dump() for f in explanation_data.top_protective_factors],
            base_value=explanation_data.base_value,
        )
        self.db.add(exp_record)
        await self.db.commit()

        return PredictionResponse(
            prediction_id=prediction_id,
            employee_number=request.employee_number,
            attrition_probability=round(probability, 4),
            risk_level=risk_level,
            model_version=settings.MODEL_VERSION,
            explanation=PredictionExplanationSchema(
                top_risk_factors=explanation_data.top_risk_factors,
                top_protective_factors=explanation_data.top_protective_factors,
                base_value=explanation_data.base_value,
            ),
            predicted_at=datetime.now(timezone.utc),
        )
