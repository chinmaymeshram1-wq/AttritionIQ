"""
Automated compatibility verification tests.
Run from the backend/ directory:
    python app/ml/artifacts/../../../tests/test_compatibility.py
Or simply:
    python tests/test_compat_check.py
"""
import sys
import os

# Ensure backend app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from app.utils.dataset_compatibility import analyze_csv_compatibility

PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"
_failures = []

def check(description: str, condition: bool, detail: str = ""):
    if condition:
        print(f"  {PASS}  {description}")
    else:
        msg = f"  {FAIL}  {description}"
        if detail:
            msg += f"\n         → {detail}"
        print(msg)
        _failures.append(description)


# ── Test 1: Original IBM HR CSV ───────────────────────────────────────────────
# ibm_row has 31 keys = EmployeeNumber (identifier) + 30 model features.
# EmployeeNumber must NOT count as a model feature.
# Expected: features_found == 30, features_required == 30, status FULLY_COMPATIBLE.
print("\n[Test 1] Original IBM HR CSV — expect FULLY_COMPATIBLE, 30/30 model features")
ibm_row = {
    'EmployeeNumber': 1, 'Age': 35, 'Gender': 'Male', 'MaritalStatus': 'Single',
    'Education': 3, 'EducationField': 'Life Sciences', 'Department': 'Sales',
    'JobRole': 'Sales Executive', 'JobLevel': 2, 'BusinessTravel': 'Travel_Rarely',
    'OverTime': 'Yes', 'MonthlyIncome': 5000, 'PercentSalaryHike': 14,
    'StockOptionLevel': 1, 'TotalWorkingYears': 10, 'YearsAtCompany': 5,
    'YearsInCurrentRole': 3, 'YearsSinceLastPromotion': 1, 'YearsWithCurrManager': 3,
    'NumCompaniesWorked': 2, 'JobSatisfaction': 3, 'EnvironmentSatisfaction': 3,
    'RelationshipSatisfaction': 3, 'WorkLifeBalance': 3, 'JobInvolvement': 3,
    'DistanceFromHome': 10, 'HourlyRate': 50, 'DailyRate': 400, 'MonthlyRate': 20000,
    'TrainingTimesLastYear': 3, 'PerformanceRating': 3,
}
df1 = pd.DataFrame([ibm_row])
r1 = analyze_csv_compatibility(df1)
_FEATURES_REQUIRED = r1.features_required   # ground truth from engine (= len(CANONICAL_FEATURES))
check("status == FULLY_COMPATIBLE", r1.status == "FULLY_COMPATIBLE", r1.status)
check(f"features_found == {_FEATURES_REQUIRED} (all model features)", r1.features_found == _FEATURES_REQUIRED, str(r1.features_found))
check("missing_features is empty", r1.missing_features == [], str(r1.missing_features))
check("data_completeness == 100.0", r1.data_completeness_percentage == 100.0, str(r1.data_completeness_percentage))
check("is_estimated == False", r1.is_estimated == False)
check("employee_id_column detected", r1.employee_id_column == 'EmployeeNumber', r1.employee_id_column)
check("EmployeeNumber NOT in mapped_columns", 'EmployeeNumber' not in r1.mapped_columns,
      f"mapped_columns keys: {list(r1.mapped_columns.keys())[:5]}")


# ── Test 2: Aliased columns CSV ───────────────────────────────────────────────
# aliased_row has 31 keys = emp_number (identifier) + 30 model features via aliases.
# Expected: features_found == 30, status FULLY_COMPATIBLE.
print("\n[Test 2] Aliased HR columns — expect FULLY_COMPATIBLE, correct mappings")
aliased_row = {
    'emp_number': 2, 'employee_age': 35, 'sex': 'Female', 'marital_status': 'Married',
    'education': 3, 'education_field': 'Medical', 'dept': 'Research & Development',
    'job_title': 'Research Scientist', 'job_level': 2, 'travel': 'Travel_Rarely',
    'ot': 'No', 'monthly_salary': 6000, 'salary_hike': 11,
    'stock_option_level': 0, 'total_experience': 8, 'tenure': 4,
    'years_in_role': 2, 'years_since_promotion': 0, 'manager_tenure': 2,
    'previous_employers': 1, 'job_satisfaction': 4, 'env_satisfaction': 4,
    'relationship_satisfaction': 3, 'work_life_balance': 3, 'job_engagement': 4,
    'commute_distance': 5, 'hourly_rate': 60, 'daily_rate': 480, 'monthly_rate': 22000,
    'training_count': 2, 'perf_rating': 3,
}
df2 = pd.DataFrame([aliased_row])
r2 = analyze_csv_compatibility(df2)
check("status == FULLY_COMPATIBLE", r2.status == "FULLY_COMPATIBLE", r2.status)
check(f"features_found == {_FEATURES_REQUIRED} (all model features via aliases)",
      r2.features_found == _FEATURES_REQUIRED,
      str(r2.features_found) + " missing=" + str(r2.missing_features))
check("'ot' → 'over_time'", r2.mapped_columns.get('ot') == 'over_time', str(r2.mapped_columns.get('ot')))
check("'dept' → 'department'", r2.mapped_columns.get('dept') == 'department', str(r2.mapped_columns.get('dept')))
check("'job_title' → 'job_role'", r2.mapped_columns.get('job_title') == 'job_role', str(r2.mapped_columns.get('job_title')))
check("'monthly_salary' → 'monthly_income'", r2.mapped_columns.get('monthly_salary') == 'monthly_income', str(r2.mapped_columns.get('monthly_salary')))
check("'tenure' → 'years_at_company'", r2.mapped_columns.get('tenure') == 'years_at_company', str(r2.mapped_columns.get('tenure')))
check("'sex' → 'gender'", r2.mapped_columns.get('sex') == 'gender', str(r2.mapped_columns.get('sex')))
check("emp_number NOT in mapped_columns", 'emp_number' not in r2.mapped_columns,
      f"emp_number mapped to: {r2.mapped_columns.get('emp_number')!r}")


# ── Test 3: Partial CSV (19 model features) ───────────────────────────────────
# partial_row has 20 keys = EmployeeNumber (identifier) + 19 model features.
# EmployeeNumber must NOT count. Expected: features_found == 19, PARTIALLY_COMPATIBLE.
print("\n[Test 3] Partial CSV (19 model features, 20 total cols) — expect PARTIALLY_COMPATIBLE")
partial_row = {
    'EmployeeNumber': 3, 'Age': 28, 'Gender': 'Male', 'MaritalStatus': 'Single',
    'Education': 2, 'EducationField': 'Marketing', 'Department': 'Sales',
    'JobRole': 'Sales Representative', 'JobLevel': 1, 'BusinessTravel': 'Non-Travel',
    'OverTime': 'No', 'MonthlyIncome': 3500, 'PercentSalaryHike': 12,
    'StockOptionLevel': 0, 'TotalWorkingYears': 3, 'YearsAtCompany': 2,
    'YearsInCurrentRole': 1, 'YearsSinceLastPromotion': 0, 'YearsWithCurrManager': 1,
    'NumCompaniesWorked': 1,
}
df3 = pd.DataFrame([partial_row])
r3 = analyze_csv_compatibility(df3)
_EXPECTED_PARTIAL = len(partial_row) - 1  # subtract EmployeeNumber (identifier)
check("status == PARTIALLY_COMPATIBLE", r3.status == "PARTIALLY_COMPATIBLE", r3.status)
check(f"features_found == {_EXPECTED_PARTIAL} (total cols minus identifier)",
      r3.features_found == _EXPECTED_PARTIAL, str(r3.features_found))
check(f"16 <= features_found < {_FEATURES_REQUIRED}", 16 <= r3.features_found < _FEATURES_REQUIRED)
check("is_estimated == True", r3.is_estimated == True)
check("estimated_prediction_safe == True", r3.estimated_prediction_safe == True)
check("missing_features non-empty", len(r3.missing_features) > 0, str(r3.missing_features))


# ── Test 4: Too few features (< 16) ──────────────────────────────────────────
print("\n[Test 4] < 16 features CSV — expect INCOMPATIBLE")
incompat_row = {
    'EmployeeNumber': 4, 'Age': 30, 'Department': 'Sales', 'JobRole': 'Manager',
    'MonthlyIncome': 7000, 'Gender': 'Male',
}
df4 = pd.DataFrame([incompat_row])
r4 = analyze_csv_compatibility(df4)
check("status == INCOMPATIBLE", r4.status == "INCOMPATIBLE", r4.status)
check("features_found < 16", r4.features_found < 16, str(r4.features_found))
check("is_estimated == False", r4.is_estimated == False)
check("estimated_prediction_safe == False", r4.estimated_prediction_safe == False)


# ── Test 5: Fully unrelated columns ──────────────────────────────────────────
print("\n[Test 5] Unrelated CSV — expect INCOMPATIBLE")
unrelated_row = {
    'OrderID': 101, 'ProductName': 'Widget', 'Revenue': 15000,
    'CustomerCity': 'Mumbai', 'ReturnRate': 0.05,
}
df5 = pd.DataFrame([unrelated_row])
r5 = analyze_csv_compatibility(df5)
check("status == INCOMPATIBLE", r5.status == "INCOMPATIBLE", r5.status)
check("features_found == 0", r5.features_found == 0, str(r5.features_found))
check("unrecognized_columns non-empty", len(r5.unrecognized_columns) > 0)


# ── Test 6: Ambiguity guard — 'salary' alone must NOT map to monthly_income ──
print("\n[Test 6] Ambiguity guard — 'salary' alone must NOT map to monthly_income")
ambig_row = {
    'EmployeeNumber': 5, 'Age': 28, 'salary': 5000, 'Gender': 'Male',
}
df6 = pd.DataFrame([ambig_row])
r6 = analyze_csv_compatibility(df6)
check("'salary' not mapped to monthly_income", r6.mapped_columns.get('salary') != 'monthly_income',
      f"'salary' was mapped to: {r6.mapped_columns.get('salary')!r}")
check("'salary' is unrecognized", 'salary' in r6.unrecognized_columns,
      f"unrecognized={r6.unrecognized_columns}")


# ── Test 7: Feature Mapper & Predictor on PARTIALLY_COMPATIBLE rows ───────────
print("\n[Test 7] Feature Mapper & Predictor on PARTIALLY_COMPATIBLE rows")
from app.utils.feature_mapping import map_row_with_compatibility
from app.ml.predictor import get_predictor
from app.ml.explainer import get_explainer

# Map the partial row (19 features mapped, 11 missing)
partial_mapped = map_row_with_compatibility(df3.iloc[0], r3.mapped_columns)
check("partial_mapped has all 30 features", len(partial_mapped) == _FEATURES_REQUIRED, str(len(partial_mapped)))
check("missing feature 'monthly_rate' is NaN", pd.isna(partial_mapped.get("monthly_rate")), str(partial_mapped.get("monthly_rate")))
check("missing feature 'relationship_satisfaction' is NaN", pd.isna(partial_mapped.get("relationship_satisfaction")), str(partial_mapped.get("relationship_satisfaction")))
check("mapped feature 'age' is 28", partial_mapped.get("age") == 28, str(partial_mapped.get("age")))

# Test predictor & explainer on partial features (must succeed with SimpleImputer)
try:
    predictor = get_predictor()
    prob = predictor.predict_proba(partial_mapped)
    check("predictor.predict_proba succeeded on partial row", 0.0 <= prob <= 1.0, f"prob={prob}")
except Exception as e:
    check("predictor.predict_proba succeeded on partial row", False, str(e))

try:
    explainer = get_explainer()
    explanation = explainer.explain(partial_mapped, prob)
    check("explainer.explain succeeded on partial row", explanation is not None and len(explanation.top_risk_factors) >= 0)
except Exception as e:
    check("explainer.explain succeeded on partial row", False, str(e))


# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
if _failures:
    print(f"\033[91m{len(_failures)} test(s) FAILED:\033[0m")
    for f in _failures:
        print(f"  • {f}")
    sys.exit(1)
else:
    print(f"\033[92mAll {7} test suites passed.\033[0m")
