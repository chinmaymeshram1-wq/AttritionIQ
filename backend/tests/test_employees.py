import math
import random
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import AsyncSessionLocal
from app.database.seed import seed_initial_data
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.utils.sanitizer import sanitize_for_json


async def get_authenticated_client():
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)
    ac = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    login_res = await ac.post(
        "/auth/login",
        json={"email": "chinmay.test@example.com", "password": "TestPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return ac, headers


def test_sanitize_for_json_primitives_and_nested():
    """Verify JSON safety sanitization layer across all data types."""
    # Non-finite floats -> None
    assert sanitize_for_json(float("nan")) is None
    assert sanitize_for_json(float("inf")) is None
    assert sanitize_for_json(float("-inf")) is None

    # Normal numbers -> unchanged
    assert sanitize_for_json(42) == 42
    assert sanitize_for_json(0) == 0
    assert sanitize_for_json(3.14159) == 3.14159
    assert sanitize_for_json(-10.5) == -10.5

    # Strings, booleans, None -> unchanged
    assert sanitize_for_json("test_string") == "test_string"
    assert sanitize_for_json(True) is True
    assert sanitize_for_json(False) is False
    assert sanitize_for_json(None) is None

    # Recursive nested dicts & lists
    nested_input = {
        "employee_id": 5,
        "active": True,
        "name": "Alex",
        "scores": [1.0, float("nan"), 3.5, float("inf"), float("-inf")],
        "metadata": {
            "rate": float("nan"),
            "valid_rate": 25.5,
            "nested_list": [{"inner_nan": float("nan"), "inner_ok": "valid"}],
        },
    }
    expected_output = {
        "employee_id": 5,
        "active": True,
        "name": "Alex",
        "scores": [1.0, None, 3.5, None, None],
        "metadata": {
            "rate": None,
            "valid_rate": 25.5,
            "nested_list": [{"inner_nan": None, "inner_ok": "valid"}],
        },
    }
    assert sanitize_for_json(nested_input) == expected_output


@pytest.mark.asyncio
async def test_get_employee_with_non_finite_values_regression():
    """
    Regression test:
    Verify that an employee record containing non-finite float values (NaN, Inf, -Inf)
    in feature_snapshot or prediction explanations returns HTTP 200 with valid JSON
    when requested via GET /employees/{employee_number}?dataset_id=...
    instead of throwing a Serialization / ValueError.
    """
    ac, headers = await get_authenticated_client()
    emp_num = random.randint(900000, 999999)

    emp_id = str(uuid.uuid4())
    pred_id = str(uuid.uuid4())
    exp_id = str(uuid.uuid4())

    async with AsyncSessionLocal() as db:
        # Employee with non-finite values in feature_snapshot
        emp = Employee(
            id=emp_id,
            employee_number=emp_num,
            dataset_id="dataset_01",
            feature_snapshot={
                "Age": 32,
                "Department": "Sales",
                "JobRole": "Sales Executive",
                "MonthlyIncome": 5200,
                "OverTime": "No",
                "HourlyRate": float("nan"),
                "DailyRate": float("inf"),
                "MonthlyRate": float("-inf"),
                "JobSatisfaction": 3,
            },
        )
        db.add(emp)
        await db.flush()

        pred = Prediction(
            id=pred_id,
            employee_id=emp.id,
            employee_number=emp_num,
            dataset_id="dataset_01",
            attrition_probability=0.25,
            risk_level="LOW",
            model_version="v1",
            input_features=emp.feature_snapshot,
        )
        db.add(pred)
        await db.flush()

        exp = PredictionExplanation(
            id=exp_id,
            prediction_id=pred_id,
            top_risk_factors=[
                {"feature": "DailyRate", "shap_value": float("nan"), "display_value": "N/A"},
                {"feature": "Age", "shap_value": 0.12, "display_value": "32"},
            ],
            top_protective_factors=[
                {"feature": "MonthlyIncome", "shap_value": -0.15, "display_value": "5200"},
            ],
            base_value=0.20,
        )
        db.add(exp)
        await db.commit()

    # Query GET /employees/{employee_number}?dataset_id=dataset_01
    response = await ac.get(f"/employees/{emp_num}?dataset_id=dataset_01", headers=headers)

    # Must return 200 OK
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    data = response.json()
    assert data["employee"]["employee_number"] == emp_num
    assert data["employee"]["feature_snapshot"]["Age"] == 32
    # Non-finite values must be serialized to null (None in Python)
    assert data["employee"]["feature_snapshot"]["HourlyRate"] is None
    assert data["employee"]["feature_snapshot"]["DailyRate"] is None
    assert data["employee"]["feature_snapshot"]["MonthlyRate"] is None
    # Explanation top risk factors non-finite shap_value must be null
    assert data["explanation"]["top_risk_factors"][0]["shap_value"] is None
    assert data["explanation"]["top_risk_factors"][1]["shap_value"] == 0.12


@pytest.mark.asyncio
async def test_batch_ingestion_with_partial_dataset_converts_nan_to_none():
    """
    Verify that when a CSV with missing features (PARTIALLY_COMPATIBLE) is ingested via batch service,
    Employee.feature_snapshot stores None (null in JSON) rather than float NaN,
    and GET /employees/{emp_num} returns HTTP 200 with valid JSON.
    """
    from app.services.batch_service import BatchService

    emp_num = random.randint(700000, 799999)
    csv_data = (
        "EmployeeNumber,Age,Gender,MaritalStatus,Education,EducationField,Department,JobRole,"
        "JobLevel,BusinessTravel,OverTime,MonthlyIncome,PercentSalaryHike,StockOptionLevel,"
        "TotalWorkingYears,YearsAtCompany,YearsInCurrentRole,YearsSinceLastPromotion,"
        "YearsWithCurrManager,NumCompaniesWorked\n"
        f"{emp_num},30,Female,Single,3,Life Sciences,Research & Development,Research Scientist,"
        "1,Travel_Rarely,No,4200,15,0,6,4,2,0,2,1\n"
    ).encode("utf-8")

    async with AsyncSessionLocal() as db:
        service = BatchService(db=db, dataset_id="dataset_01")
        resp = await service.process_batch(csv_data)
        assert resp.successful == 1

    ac, headers = await get_authenticated_client()
    get_res = await ac.get(f"/employees/{emp_num}?dataset_id=dataset_01", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["employee"]["employee_number"] == emp_num
    assert data["employee"]["feature_snapshot"]["Age"] == 30 or data["employee"]["feature_snapshot"].get("age") == 30


@pytest.mark.asyncio
async def test_employee_search_datasets_and_read_only_isolation():
    """
    Test specifically:
    Dataset 01 -> Employee Search -> 5 (Exists -> 200)
    Dataset 01 -> Employee Search -> 6 (Exists -> 200)
    Dataset 02 -> Employee Search -> 6 (Exists -> 200)
    Dataset 02 -> Employee Search -> 7 (Exists -> 200)
    And Dataset 01 -> Employee Search -> 7 (Not in Dataset 01 -> 404)

    Verifies:
    1. Employee search is strictly READ-ONLY (does not insert records into Employee table).
    2. Dataset isolation remains intact (dataset file scopes the search).
    3. JSON serialization succeeds cleanly without ValueError: Out of range float values.
    """
    from sqlalchemy import select, func

    # Dataset 01 contains employees 5 and 6 (with some missing/partial features that evaluate to NaN)
    dataset_01_csv = (
        "EmployeeNumber,Age,Gender,Department,JobRole,MonthlyIncome,HourlyRate,OverTime\n"
        "5,41,Female,Sales,Sales Executive,5993,,Yes\n"
        "6,49,Male,Research & Development,Research Scientist,5130,NaN,No\n"
    ).encode("utf-8")

    # Dataset 02 contains employees 6 and 7
    dataset_02_csv = (
        "EmployeeNumber,Age,Gender,Department,JobRole,MonthlyIncome,YearsAtCompany\n"
        "6,29,Female,Sales,Sales Executive,3800,2\n"
        "7,34,Male,Human Resources,Human Resources,4100,5\n"
    ).encode("utf-8")

    ac, headers = await get_authenticated_client()

    # Record baseline employee count in DB
    async with AsyncSessionLocal() as db:
        initial_emp_count = (await db.execute(select(func.count(Employee.id)))).scalar_one()

    # 1. Dataset 01 -> Search 5
    res_d1_5 = await ac.post(
        "/employees/search",
        data={"employee_id": "5"},
        files={"file": ("dataset_01.csv", dataset_01_csv, "text/csv")},
        headers=headers,
    )
    assert res_d1_5.status_code == 200, f"D1 Emp 5 failed: {res_d1_5.text}"
    d1_5_data = res_d1_5.json()
    assert d1_5_data["employee_row"]["EmployeeNumber"] == 5
    assert d1_5_data["employee_row"]["HourlyRate"] is None  # empty/NaN converted to None

    # 2. Dataset 01 -> Search 6
    res_d1_6 = await ac.post(
        "/employees/search",
        data={"employee_id": "6"},
        files={"file": ("dataset_01.csv", dataset_01_csv, "text/csv")},
        headers=headers,
    )
    assert res_d1_6.status_code == 200, f"D1 Emp 6 failed: {res_d1_6.text}"
    d1_6_data = res_d1_6.json()
    assert d1_6_data["employee_row"]["EmployeeNumber"] == 6
    assert d1_6_data["employee_row"]["HourlyRate"] is None

    # 3. Dataset 02 -> Search 6
    res_d2_6 = await ac.post(
        "/employees/search",
        data={"employee_id": "6"},
        files={"file": ("dataset_02.csv", dataset_02_csv, "text/csv")},
        headers=headers,
    )
    assert res_d2_6.status_code == 200, f"D2 Emp 6 failed: {res_d2_6.text}"
    d2_6_data = res_d2_6.json()
    assert d2_6_data["employee_row"]["EmployeeNumber"] == 6
    assert d2_6_data["employee_row"]["Department"] == "Sales"
    assert d2_6_data["employee_row"]["Age"] == 29

    # 4. Dataset 02 -> Search 7
    res_d2_7 = await ac.post(
        "/employees/search",
        data={"employee_id": "7"},
        files={"file": ("dataset_02.csv", dataset_02_csv, "text/csv")},
        headers=headers,
    )
    assert res_d2_7.status_code == 200, f"D2 Emp 7 failed: {res_d2_7.text}"
    d2_7_data = res_d2_7.json()
    assert d2_7_data["employee_row"]["EmployeeNumber"] == 7
    assert d2_7_data["employee_row"]["Department"] == "Human Resources"

    # 5. Dataset isolation check: Employee 7 does not exist in Dataset 01
    res_d1_7 = await ac.post(
        "/employees/search",
        data={"employee_id": "7"},
        files={"file": ("dataset_01.csv", dataset_01_csv, "text/csv")},
        headers=headers,
    )
    assert res_d1_7.status_code == 404

    # 6. Verify READ-ONLY: Employee count in DB must remain identical
    async with AsyncSessionLocal() as db:
        final_emp_count = (await db.execute(select(func.count(Employee.id)))).scalar_one()
    assert final_emp_count == initial_emp_count, "Employee Search must not create new employee records!"
