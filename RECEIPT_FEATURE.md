# Receipt Photo Processing Feature Plan

## Overview
Add an "Add by Photo" button to the manage transactions page that opens a mobile-friendly photo upload dialog. Use Anthropic's Claude Vision API to extract transaction data (description, amount, date, category) from receipt images, then populate the existing transaction form for user review and submission.

## Implementation Steps

### 1. Environment Setup
- Add `ANTHROPIC_API_KEY` environment variable
- Install `@anthropic-ai/sdk` package
- Update environment validation in lib/env

### 2. Photo Upload Dialog Component
- Create `PhotoUploadDialog` component with mobile-friendly interface
- Support camera capture and file upload
- Add image preview with crop/rotate functionality
- Include loading states and error handling

### 3. Receipt Processing API
- Create `/api/receipts/process` endpoint
- Implement image preprocessing (resize, format conversion)
- Fetch household's categories and outflow transaction types from database
- Integrate Anthropic Claude Vision API with a structured prompt that:
  - Includes the list of available categories and transaction types
  - Requests extraction of: amount, date, and a brief description
  - Asks Claude to select the best matching category and transaction type from the provided lists
- Return structured JSON response with all extracted fields

### 4. AI Prompt Engineering
- Design prompt that provides household's categories and outflow transaction types as context
- Request specific output format:
  - `amount`: Decimal number from the receipt total
  - `date`: Transaction date in ISO format
  - `description`: Brief description (e.g., "Walmart - Groceries")
  - `categoryId`: Selected category ID from provided list
  - `typeId`: Selected transaction type ID from provided list (outflow types only)
- Include instructions for handling edge cases (unclear receipts, multiple totals, etc.)

### 5. Transaction Form Integration
- Modify `TransactionForm` to accept pre-populated data prop
- Add photo processing workflow to transaction grid
- Chain photo upload → AI processing → form population

### 6. UI Integration
- Add "Add by Photo" button to manage transactions page
- Implement mobile-responsive design patterns
- Add success/error notifications

### 7. Testing & Validation
- Test with various receipt types and formats
- Validate data extraction accuracy
- Ensure mobile compatibility across devices

## Technical Requirements
- Anthropic Claude Vision API integration
- Image preprocessing with Sharp (already available)
- Mobile camera access permissions
- File upload size limits and validation
- Error handling for API failures

## Files to Modify/Create
- `src/components/photo-upload-dialog.tsx` (new)
- `src/app/api/receipts/process/route.ts` (new)
- `src/lib/anthropic.ts` (new)
- `src/components/transaction-form.tsx` (modify)
- `src/components/transaction-grid.tsx` (modify)
- `package.json` (add @anthropic-ai/sdk)
- `.env.local` (add ANTHROPIC_API_KEY)

This plan leverages the existing robust transaction system while adding AI-powered receipt processing capabilities.