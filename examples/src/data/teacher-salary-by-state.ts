/**
 * Average public-school teacher salary by state in constant (inflation-adjusted) dollars,
 * 1999-00 and 2021-22: 50 states, DC and a United States row.
 *
 * Rows are the OpenData dataset `nces/teacher-salary-by-state` (view `all`, metric
 * `salary_constant`), queried on 2026-11-22 with:
 * SELECT state, ROUND(MAX(value) FILTER (WHERE period='1999_00')) AS salary_1999_00,
 * ROUND(MAX(value) FILTER (WHERE period='2021_22')) AS salary_2021_22 FROM data
 * WHERE metric='salary_constant' AND TRY_CAST(state AS INT) IS NULL GROUP BY 1 ORDER BY 1
 *
 * The metadata does not state the base year of the constant dollars. The United States row is
 * the national average, not a state; it is part of the rows and callers should filter it out.
 * Verified against the rows: salary fell in 36 of the 51 states and DC between the periods.
 * The metadata lists the license as unknown and the landing page below as the source.
 */
export const teacherSalaryByState = {
  source: 'Source: NCES, Digest of Education Statistics, Table 211.60',
  url: 'https://nces.ed.gov/programs/digest/d22/tables/dt22_211.60.asp',
  data: [
    { state: 'Alabama', salary_1999_00: 61121.0, salary_2021_22: 55834.0 },
    { state: 'Alaska', salary_1999_00: 77401.0, salary_2021_22: 73722.0 },
    { state: 'Arizona', salary_1999_00: 61475.0, salary_2021_22: 54580.0 },
    { state: 'Arkansas', salary_1999_00: 55618.0, salary_2021_22: 52486.0 },
    { state: 'California', salary_1999_00: 79431.0, salary_2021_22: 87275.0 },
    { state: 'Colorado', salary_1999_00: 63576.0, salary_2021_22: 58481.0 },
    { state: 'Connecticut', salary_1999_00: 86261.0, salary_2021_22: 81185.0 },
    { state: 'Delaware', salary_1999_00: 74025.0, salary_2021_22: 65647.0 },
    { state: 'District of Columbia', salary_1999_00: 78424.0, salary_2021_22: 82523.0 },
    { state: 'Florida', salary_1999_00: 61175.0, salary_2021_22: 51230.0 },
    { state: 'Georgia', salary_1999_00: 68341.0, salary_2021_22: 61249.0 },
    { state: 'Hawaii', salary_1999_00: 67599.0, salary_2021_22: 67000.0 },
    { state: 'Idaho', salary_1999_00: 59218.0, salary_2021_22: 54232.0 },
    { state: 'Illinois', salary_1999_00: 77441.0, salary_2021_22: 72301.0 },
    { state: 'Indiana', salary_1999_00: 69718.0, salary_2021_22: 54126.0 },
    { state: 'Iowa', salary_1999_00: 59436.0, salary_2021_22: 59262.0 },
    { state: 'Kansas', salary_1999_00: 58275.0, salary_2021_22: 54815.0 },
    { state: 'Kentucky', salary_1999_00: 60606.0, salary_2021_22: 54574.0 },
    { state: 'Louisiana', salary_1999_00: 55157.0, salary_2021_22: 52376.0 },
    { state: 'Maine', salary_1999_00: 59241.0, salary_2021_22: 58757.0 },
    { state: 'Maryland', salary_1999_00: 73380.0, salary_2021_22: 75766.0 },
    { state: 'Massachusetts', salary_1999_00: 77598.0, salary_2021_22: 88903.0 },
    { state: 'Michigan', salary_1999_00: 81703.0, salary_2021_22: 65198.0 },
    { state: 'Minnesota', salary_1999_00: 66306.0, salary_2021_22: 68491.0 },
    { state: 'Mississippi', salary_1999_00: 53071.0, salary_2021_22: 47162.0 },
    { state: 'Missouri', salary_1999_00: 59400.0, salary_2021_22: 52481.0 },
    { state: 'Montana', salary_1999_00: 53511.0, salary_2021_22: 53628.0 },
    { state: 'Nebraska', salary_1999_00: 55370.0, salary_2021_22: 57420.0 },
    { state: 'Nevada', salary_1999_00: 65620.0, salary_2021_22: 57804.0 },
    { state: 'New Hampshire', salary_1999_00: 62861.0, salary_2021_22: 62783.0 },
    { state: 'New Jersey', salary_1999_00: 86652.0, salary_2021_22: 79045.0 },
    { state: 'New Mexico', salary_1999_00: 54232.0, salary_2021_22: 54272.0 },
    { state: 'New York', salary_1999_00: 84995.0, salary_2021_22: 92222.0 },
    { state: 'North Carolina', salary_1999_00: 65643.0, salary_2021_22: 53644.0 },
    { state: 'North Dakota', salary_1999_00: 49749.0, salary_2021_22: 55769.0 },
    { state: 'Ohio', salary_1999_00: 69029.0, salary_2021_22: 63153.0 },
    { state: 'Oklahoma', salary_1999_00: 52140.0, salary_2021_22: 54804.0 },
    { state: 'Oregon', salary_1999_00: 70528.0, salary_2021_22: 69671.0 },
    { state: 'Pennsylvania', salary_1999_00: 80498.0, salary_2021_22: 72248.0 },
    { state: 'Rhode Island', salary_1999_00: 78366.0, salary_2021_22: 76852.0 },
    { state: 'South Carolina', salary_1999_00: 60108.0, salary_2021_22: 53393.0 },
    { state: 'South Dakota', salary_1999_00: 48430.0, salary_2021_22: 49761.0 },
    { state: 'Tennessee', salary_1999_00: 60519.0, salary_2021_22: 53619.0 },
    { state: 'Texas', salary_1999_00: 62583.0, salary_2021_22: 58887.0 },
    { state: 'United States', salary_1999_00: 69647.0, salary_2021_22: 66397.0 },
    { state: 'Utah', salary_1999_00: 58217.0, salary_2021_22: 58619.0 },
    { state: 'Vermont', salary_1999_00: 62901.0, salary_2021_22: 62866.0 },
    { state: 'Virginia', salary_1999_00: 64544.0, salary_2021_22: 59965.0 },
    { state: 'Washington', salary_1999_00: 68374.0, salary_2021_22: 81586.0 },
    { state: 'West Virginia', salary_1999_00: 58322.0, salary_2021_22: 50315.0 },
    { state: 'Wisconsin', salary_1999_00: 68557.0, salary_2021_22: 60453.0 },
    { state: 'Wyoming', salary_1999_00: 56852.0, salary_2021_22: 60820.0 },
  ],
};
