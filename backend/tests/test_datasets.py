import os
import pytest
import io

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "WA_Fn-UseC_-HR-Employee-Attrition.csv")

def get_test_csv_bytes(slice_lines: int = 10) -> bytes:
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        lines = [f.readline() for _ in range(slice_lines + 1)]
    return "".join(lines).encode("utf-8")


@pytest.fixture(autouse=True)
async def clear_datasets_fixture(client, test_user):
    """Clean up datasets before each test run so dataset count starts fresh."""
    headers = {"Authorization": f"Bearer {test_user['token']}"}
    res = await client.get("/datasets", headers=headers)
    if res.status_code == 200:
        for ds in res.json().get("datasets", []):
            await client.delete(f"/datasets/{ds['id']}", headers=headers)
    yield


@pytest.mark.asyncio
async def test_dataset_creation_and_numbering(client, db_session, test_user):
    """Test dataset creation, dataset numbering, and max 7 datasets limit."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    # 1. Initially no datasets exist
    res = await client.get("/datasets", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["datasets"] == []
    assert data["max_allowed"] == 7

    # 2. Upload sample CSV 1 -> should become Dataset 01
    csv1_bytes = get_test_csv_bytes(5)
    files = {"file": ("test_company_1.csv", io.BytesIO(csv1_bytes), "text/csv")}

    upload_res = await client.post("/datasets/upload", files=files, headers=auth_headers)
    assert upload_res.status_code == 200, upload_res.text
    ds1 = upload_res.json()
    assert ds1["dataset_number"] == 1
    assert "Dataset 01" in ds1["name"]
    assert ds1["status"] == "READY"
    assert ds1["employee_count"] == 5

    # 3. Upload sample CSV 2 -> should become Dataset 02
    csv2_bytes = get_test_csv_bytes(8)
    files_2 = {"file": ("test_company_2.csv", io.BytesIO(csv2_bytes), "text/csv")}

    upload_res_2 = await client.post("/datasets/upload", files=files_2, headers=auth_headers)
    assert upload_res_2.status_code == 200, upload_res_2.text
    ds2 = upload_res_2.json()
    assert ds2["dataset_number"] == 2
    assert "Dataset 02" in ds2["name"]
    assert ds2["status"] == "READY"
    assert ds2["employee_count"] == 8

    # 4. List datasets
    res_list = await client.get("/datasets", headers=auth_headers)
    datasets = res_list.json()["datasets"]
    assert len(datasets) == 2
    assert datasets[0]["dataset_number"] == 1
    assert datasets[1]["dataset_number"] == 2


@pytest.mark.asyncio
async def test_maximum_7_datasets_limit(client, db_session, test_user):
    """Test that uploading an 8th dataset is blocked with HTTP 400."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    csv_bytes = get_test_csv_bytes(2)

    # Create 7 datasets
    for i in range(1, 8):
        files = {"file": (f"dataset_{i}.csv", io.BytesIO(csv_bytes), "text/csv")}
        res = await client.post("/datasets/upload", files=files, headers=auth_headers)
        assert res.status_code == 200, res.text
        assert res.json()["dataset_number"] == i

    # Attempt to upload 8th dataset
    files_8 = {"file": ("dataset_8.csv", io.BytesIO(csv_bytes), "text/csv")}
    res_8 = await client.post("/datasets/upload", files=files_8, headers=auth_headers)
    assert res_8.status_code == 400
    assert "Maximum limit of 7 datasets" in res_8.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_employee_12_in_different_datasets(client, db_session, test_user):
    """Test that Employee #12 can exist independently in Dataset 01 and Dataset 02."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    csv_bytes = get_test_csv_bytes(15)

    # Upload Dataset 01
    ds1_res = await client.post("/datasets/upload", files={"file": ("company1.csv", io.BytesIO(csv_bytes), "text/csv")}, headers=auth_headers)
    assert ds1_res.status_code == 200, ds1_res.text
    ds1 = ds1_res.json()

    # Upload Dataset 02
    ds2_res = await client.post("/datasets/upload", files={"file": ("company2.csv", io.BytesIO(csv_bytes), "text/csv")}, headers=auth_headers)
    assert ds2_res.status_code == 200, ds2_res.text
    ds2 = ds2_res.json()

    # In authentic IBM dataset, row 1 is employee number 1
    # Both datasets contain Employee #1
    emp1_res = await client.get(f"/employees/1?dataset_id={ds1['id']}", headers=auth_headers)
    assert emp1_res.status_code == 200, emp1_res.text
    emp1_data = emp1_res.json()["employee"]
    assert emp1_data["dataset_id"] == ds1["id"]

    emp2_res = await client.get(f"/employees/1?dataset_id={ds2['id']}", headers=auth_headers)
    assert emp2_res.status_code == 200, emp2_res.text
    emp2_data = emp2_res.json()["employee"]
    assert emp2_data["dataset_id"] == ds2["id"]

    assert emp1_data["id"] != emp2_data["id"]


@pytest.mark.asyncio
async def test_dashboard_count_and_analytics_isolation(client, db_session, test_user):
    """Test that dashboard counts and analytics isolate metrics by active dataset_id."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    # Dataset 1: 5 employees
    ds1_res = await client.post("/datasets/upload", files={"file": ("d1.csv", io.BytesIO(get_test_csv_bytes(5)), "text/csv")}, headers=auth_headers)
    assert ds1_res.status_code == 200, ds1_res.text
    ds1 = ds1_res.json()

    # Dataset 2: 12 employees
    ds2_res = await client.post("/datasets/upload", files={"file": ("d2.csv", io.BytesIO(get_test_csv_bytes(12)), "text/csv")}, headers=auth_headers)
    assert ds2_res.status_code == 200, ds2_res.text
    ds2 = ds2_res.json()

    # Dashboard Summary for Dataset 01
    dash1 = (await client.get(f"/dashboard/summary?dataset_id={ds1['id']}", headers=auth_headers)).json()
    assert dash1["total_employees_analyzed"] == 5

    # Dashboard Summary for Dataset 02
    dash2 = (await client.get(f"/dashboard/summary?dataset_id={ds2['id']}", headers=auth_headers)).json()
    assert dash2["total_employees_analyzed"] == 12


@pytest.mark.asyncio
async def test_individual_prediction_does_not_affect_dataset_counts(client, db_session, test_user):
    """Test that Individual Prediction is standalone and does NOT alter dataset employee count."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    # Upload Dataset 01 with 5 employees
    ds1_res = await client.post("/datasets/upload", files={"file": ("d1.csv", io.BytesIO(get_test_csv_bytes(5)), "text/csv")}, headers=auth_headers)
    assert ds1_res.status_code == 200, ds1_res.text
    ds1 = ds1_res.json()

    # Initial dataset employee count
    dash_before = (await client.get(f"/dashboard/summary?dataset_id={ds1['id']}", headers=auth_headers)).json()
    assert dash_before["total_employees_analyzed"] == 5

    # Run Individual Prediction
    ind_payload = {
        "employee_number": 9999,
        "age": 35,
        "gender": "Male",
        "department": "Sales",
        "job_role": "Sales Executive",
        "job_level": 2,
        "overtime": "Yes",
        "monthly_income": 6000.0,
        "percent_salary_hike": 15,
        "stock_option_level": 1,
        "distance_from_home": 5,
        "education": 3,
        "education_field": "Life Sciences",
        "environment_satisfaction": 3,
        "job_satisfaction": 3,
        "work_life_balance": 3,
        "job_involvement": 3,
        "years_at_company": 5,
        "years_in_current_role": 3,
        "years_since_last_promotion": 1,
        "years_with_curr_manager": 2,
        "total_working_years": 8,
        "num_companies_worked": 2,
        "performance_rating": 3,
        "relationship_satisfaction": 3,
        "hourly_rate": 50.0,
        "daily_rate": 500.0,
        "monthly_rate": 15000.0,
        "training_times_last_year": 2,
        "business_travel": "Travel_Rarely",
        "marital_status": "Married",
    }
    ind_res = await client.post("/prediction/individual", json=ind_payload, headers=auth_headers)
    assert ind_res.status_code == 200, ind_res.text

    # Dataset count must remain 5
    dash_after = (await client.get(f"/dashboard/summary?dataset_id={ds1['id']}", headers=auth_headers)).json()
    assert dash_after["total_employees_analyzed"] == 5
