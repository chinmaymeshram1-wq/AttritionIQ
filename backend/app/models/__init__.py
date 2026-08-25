# Import all models here so Alembic / init_db can discover them
from app.models.user import User
from app.models.organization import Organization
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation

__all__ = ["User", "Organization", "Employee", "Prediction", "PredictionExplanation"]
