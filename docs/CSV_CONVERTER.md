# CSV Converter

The CSV Converter utility transforms institution-exported CSV files into a standardized Finance Tracker Excel (.xlsx) file ready for bulk import. Each institution has unique CSV headers, date formats, and amount conventions — the converter normalizes all of these into a single output format.

Source: `src/lib/csv-converter.ts` and `src/components/csv-converter-page.tsx`

---

## Supported Institutions

### Fidelity

Expenses are exported as **negative** amounts. Credits are **positive** amounts.

**Date format:** `YYYY-MM-DD` (ISO)
**Amount inversion:** None

**CSV headers:**

| Header        | Mapped To        | Notes     |
|---------------|------------------|-----------|
| `Date`        | Transaction Date | ISO format |
| `Transaction` | —                | Discarded |
| `Name`        | Description      |           |
| `Memo`        | —                | Discarded |
| `Amount`      | Amount           |           |

**Example row:**

```csv
"Date","Transaction","Name","Memo","Amount"
"2026-02-02","DEBIT","Riverstone Coffee Roasters  Portland   OR","83716294050018372649100; 04291; ; ; ; ;","-42.15"
```

---

### American Express

Expenses are exported as **positive** amounts. Credits are **negative** amounts.

**Date format:** `MM/DD/YYYY`
**Amount inversion:** Yes — values are multiplied by `-1` so expenses become negative and credits become positive.

**CSV headers:**

| Header        | Mapped To        | Notes                    |
|---------------|------------------|--------------------------|
| `Date`        | Transaction Date | MM/DD/YYYY format        |
| `Description` | Description      |                          |
| `Card Member` | —                | Discarded                |
| `Account #`   | —                | Discarded                |
| `Amount`      | Amount           | Inverted on conversion   |

**Example row:**

```csv
Date,Description,Card Member,Account #,Amount
02/19/2026,PINECREST MARKET    pinecrestmkt.com    NY,TEST USER,-83021,24.50
```

---

### Chase

Expenses are exported as **negative** amounts. Credits are **positive** amounts.

**Date format:** `MM/DD/YYYY`
**Amount inversion:** None

**CSV headers:**

| Header           | Mapped To        | Notes     |
|------------------|------------------|-----------|
| `Transaction Date` | Transaction Date |           |
| `Post Date`      | Post Date        |           |
| `Description`    | Description      |           |
| `Category`       | —                | Discarded |
| `Type`           | —                | Discarded |
| `Amount`         | Amount           |           |
| `Memo`           | —                | Discarded |

**Example row:**

```csv
Transaction Date,Post Date,Description,Category,Type,Amount,Memo
02/27/2026,02/27/2026,BRIGHTLEAF BOOKSHOP,,Shopping,-31.87,
```

---

## Output: Finance Tracker Excel Format

The converter produces an `.xlsx` workbook with a **Transactions** sheet and a hidden **_Lists** sheet used for dropdown validations.

**Header row:**

```
Account | User | Transaction Date | Post Date | Description | Category | Type | Amount | Memo
```

### Column Details

| Column           | Type   | Format        | Populated By     | Data Validation                                  |
|------------------|--------|---------------|------------------|--------------------------------------------------|
| **Account**      | Text   | `@`           | User (dropdown)  | Household's defined accounts                     |
| **User**         | Text   | `@`           | User (dropdown)  | Household's defined users                        |
| **Transaction Date** | Date | `mm/dd/yyyy` | Mapped from CSV  | —                                                |
| **Post Date**    | Date   | `mm/dd/yyyy`  | Mapped from CSV  | —                                                |
| **Description**  | Text   | `@`           | Mapped from CSV  | Sanitized against formula injection              |
| **Category**     | Text   | `@`           | User (dropdown)  | Household's defined categories                   |
| **Type**         | Text   | `@`           | User (dropdown)  | Household's defined transaction types            |
| **Amount**       | Number | `#,##0.00`    | Mapped from CSV  | Non-numeric values produce blank cells           |
| **Memo**         | Text   | `@`           | User (manual)    | —                                                |

### Notes

- **Account**, **User**, **Category**, **Type**, and **Memo** columns are left blank for the user to fill in via dropdown or manually.
- Dropdown lists are powered by a hidden `_Lists` worksheet sourced from the household's definitions.
- Descriptions are sanitized to prevent Excel formula injection (values starting with `=`, `+`, `@`, tab, or carriage return are prefixed with `'`).
- Dates are converted to `MM/DD/YYYY` format regardless of the source institution's format.
- Non-numeric or empty amount values produce blank cells rather than zero.