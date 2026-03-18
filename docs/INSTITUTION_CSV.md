# Fidelity
Expenses are exported as negative amounts. Credits are postitive amounts.

## Example Data
Header Row
"Date","Transaction","Name","Memo","Amount"

Sample Data Row
"2026-02-02","DEBIT","Blizzard Entertainment Irvine        CA","24793386032002467782225; 05816; ; ; ; ;","-85.79"

## Mapping
- Date to Transaction Date
- Transaction should be discarded
- Name to Description
- Memo should be discarded
- Amount to Amount

# American Express
Expenses are exported as postitive amounts. Credits are negative amounts.

## Example Data
Header Row
Date,Description,Card Member,Account #,Amount

Sample Data Row
02/19/2026,UBER ONE            help.uber.com       CA,CHRISTOPHER ROWLAND,-51004,9.99

## Mapping
- Date to Transaction Date
- Description to Description
- Card Member should be discarded
- Account # should be discarded
- Amount to Amount (Invert the value so expenses become negative and credits become positive)

# Chase
Expenses are exported as negative amounts. Credits are postitive amounts.

## Example Data
Header Row
Transaction Date,Post Date,Description,Category,Type,Amount,Memo

Sample Data Row
02/27/2026,02/27/2026,AUTOMATIC PAYMENT - THANK,,Payment,1916.14,

## Mapping
- Transaction Date to Transaction Date
- Post Date to Post Date
- Description to Description
- Category should be discarded
- Type should be discarded
- Amount to Amount
- Memo should be discarded

# Finance Tracker Excel Format

Header Row
Account,User,Transaction Date,Post Date,Description,Category,Type,Amount,Memo

# Column Details
* Account
    * Column should be unpopulated
    * Excel column should be of type Text
    * Excel Data Validation on column only allowing the Household's defined Accounts
* User
    * Column should be unpopulated
    * Excel column should be of type Text
    * Excel Data Validation on column only allowing the Household's defined Users
* Transaction Date
    * Column contain the mapped value from the source file for each row
    * Excel column should be of type Date
    * Convert the date to MM/DD/YYYY format
* Post Date
    * Column contain the mapped value from the source file for each row
    * Excel column should be of type Date
    * Convert the date to MM/DD/YYYY format
* Description
    * Column contain the mapped value from the source file for each row
    * Excel column should be of type Text
* Category
    * Column should be unpopulated
    * Excel column should be of type Text
    * Excel Data Validation on column only allowing the Household's defined Category
* Type
    * Column should be unpopulated
    * Excel column should be of type Text
    * Excel Data Validation on column only allowing the Household's defined Transaction Types
* Amount
    * Column contain the mapped value from the source file for each row
    * Excel column should be of type Number
* Memo
    * Column should be unpopulated
    * Excel column should be of type Text