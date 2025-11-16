# 🚀 JDT PDF Converter - Feature Guide v2.0

## Table of Contents
1. [Core Features](#core-features)
2. [New Enhanced Features](#new-enhanced-features)
3. [Usage Guide](#usage-guide)
4. [Tips & Tricks](#tips--tricks)

---

## Core Features

### 📄 PDF Extraction Modes

#### Tables Only
- Extracts all tables from selected pages
- Preserves table structure and formatting
- Each table saved to separate sheet (unless merged)

#### Text Only
- Extracts plain text content
- Organized by page number
- Useful for text-heavy documents

#### Both Tables & Text
- Combines both extraction modes
- Tables in separate sheets, text in dedicated sheet
- Complete document data capture

### ⚙️ Advanced Options

**Page Range Selection**
- `all` - Extract from all pages
- `1-5` - Extract pages 1 through 5
- `1,3,5` - Extract specific pages
- `1-3,7,9-12` - Mix ranges and individual pages

**Merge Tables**
- Combines all extracted tables into single sheet
- Useful for multi-page reports with consistent structure

**Include Headers**
- Treats first row of each table as column headers
- Improves Excel readability and data analysis

**Clean Data**
- Removes completely empty rows and columns
- Strips leading/trailing whitespace
- Produces cleaner, more usable output

**Password Support**
- Handles encrypted PDFs
- Secure processing - passwords not stored

---

## New Enhanced Features

### 📊 Data Preview (NEW!)

**What it does:**
- Shows first 50 rows of extracted data before downloading
- Interactive table view with scrolling
- Verify extraction quality before committing

**How to use:**
1. Complete PDF conversion
2. Click "Preview Data" button in success screen
3. Review extracted data in modal
4. Close preview and download when satisfied

**Benefits:**
- Catch extraction issues early
- Verify table structure is correct
- No need to download and open file to check

---

### 💾 Settings Templates (NEW!)

**What it does:**
- Save frequently-used extraction configurations
- Quick-load saved settings for similar PDFs
- Stored locally in browser (no server storage)

**How to use:**

**Saving a Template:**
1. Configure extraction settings (page range, mode, etc.)
2. Click "Save Template" button
3. Enter descriptive name (e.g., "Financial Reports")
4. Click Save

**Loading a Template:**
1. Click template dropdown menu
2. Select saved template
3. All settings automatically applied

**Managing Templates:**
- Templates saved per browser/device
- No limit on number of templates
- Delete by accessing browser's localStorage

**Use Cases:**
- **Financial Reports**: Pages 2-5, tables only, merge enabled, clean data
- **Invoices**: Page 1, tables only, headers included
- **Research Papers**: All pages, both tables & text, no merge
- **Forms**: Specific pages, text only

---

### 📜 Conversion History (NEW!)

**What it does:**
- Tracks your last 10 conversions in current session
- Shows filename, timestamp, and status
- Quick re-download of recent conversions

**How to use:**
1. Click History button (clock icon) in header
2. View list of recent conversions
3. Click "Download" button on any completed conversion
4. Re-download without re-converting

**Details:**
- Stores up to 10 recent conversions per user
- Session-based (clears on browser close/restart)
- Shows conversion status (completed/error/pending)
- Displays original filename and timestamp

**Benefits:**
- No need to re-upload and re-convert
- Quick access to recent files
- Track your conversion activity

---

### 🌙 Dark Mode (NEW!)

**What it does:**
- Eye-friendly dark theme for low-light environments
- Reduces eye strain during extended use
- Preserves battery on OLED screens

**How to use:**
1. Click moon/sun icon in header
2. Theme toggles instantly
3. Preference saved automatically

**Features:**
- Smooth color transitions
- All UI elements themed (modals, tables, forms)
- Persistent across sessions
- Toggle anytime with single click

**Colors:**
- Background: Deep blue-grey gradients
- Cards: Dark charcoal with blue accents
- Text: Light grey for readability
- Accents: Bright blue for contrast

---

## Usage Guide

### Basic Workflow

1. **Upload PDF**
   - Click file input or drag-and-drop
   - Maximum size: 50MB
   - Must be valid PDF format

2. **Configure Settings**
   - Select page range
   - Choose extraction mode
   - Set output format (Excel/CSV)
   - Enable/disable options as needed
   - Optional: Load a saved template

3. **Convert**
   - Click "Convert to Excel" button
   - Watch real-time progress bar
   - Wait for completion (typically < 1 minute)

4. **Preview & Download**
   - Click "Preview Data" to verify (optional)
   - Click "Download File" to save
   - Or use History to download later

5. **Convert Another**
   - Click "Convert Another" to reset
   - Or adjust settings and re-upload

---

### Advanced Workflow with New Features

**Scenario: Processing Monthly Reports**

1. **First Time Setup**
   - Upload report PDF
   - Set: Pages 2-10, Tables only, Merge enabled, Headers on
   - Click "Save Template" → Name: "Monthly Reports"
   - Convert and download

2. **Next Month**
   - Upload new report
   - Select "Monthly Reports" from template dropdown
   - Settings auto-applied!
   - Convert with one click

3. **Later Access**
   - Need last month's file again?
   - Click History button
   - Find file by timestamp
   - Download instantly

**Scenario: Quality Control**

1. Upload complex PDF with multiple tables
2. Convert with preview enabled
3. Click "Preview Data"
4. Verify table structure is correct
5. If issues found, adjust settings and retry
6. Download when satisfied

---

## Tips & Tricks

### 🎯 Best Practices

**For Clean Extractions:**
- Always enable "Clean Data" option
- Use "Include Headers" for structured tables
- Preview data before downloading complex PDFs

**For Large PDFs:**
- Extract specific page ranges instead of "all"
- Process in batches if file is very large
- Use CSV format for faster processing

**For Repetitive Tasks:**
- Create templates for common PDF types
- Use descriptive template names
- Keep extraction settings simple and reusable

### ⚡ Performance Tips

**Faster Conversions:**
- Smaller page ranges process faster
- "Tables Only" mode is quickest
- CSV output is faster than Excel for large datasets

**Server Efficiency:**
- Files auto-delete after 30 seconds post-download
- Old data cleaned up after 1 hour
- No manual cleanup needed

### 🔧 Troubleshooting

**No Data Extracted:**
- PDF might be scanned image (no text layer)
- Try different page range
- Check if PDF is corrupted

**Wrong Table Structure:**
- Disable "Include Headers" if first row is data
- Try without "Merge Tables" option
- Preview before downloading to verify

**Slow Conversion:**
- Large page count takes longer
- Complex tables increase processing time
- Check progress bar for status

**Template Not Loading:**
- Templates are browser-specific
- Clear browser cache if issues persist
- Re-create template if corrupted

---

## Feature Comparison

| Feature | Basic (v1.0) | Enhanced (v2.0) |
|---------|--------------|-----------------|
| PDF Extraction | ✅ | ✅ |
| Page Selection | ✅ | ✅ |
| Multiple Modes | ✅ | ✅ |
| Password Support | ✅ | ✅ |
| Data Preview | ❌ | ✅ NEW |
| Settings Templates | ❌ | ✅ NEW |
| History Tracking | ❌ | ✅ NEW |
| Dark Mode | ❌ | ✅ NEW |
| Improved UI | ❌ | ✅ NEW |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close Modal | ESC |
| Toggle Dark Mode | Alt + D (custom) |
| Focus File Input | Tab navigation |

---

## Browser Support

✅ **Fully Supported:**
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+
- Opera 76+

⚠️ **Partial Support:**
- Internet Explorer (not recommended)
- Older mobile browsers

---

## Privacy & Security

- ✅ No data stored on server after download
- ✅ Automatic file cleanup (30 seconds)
- ✅ Session-based history (cleared on logout)
- ✅ Templates stored locally only
- ✅ No tracking or analytics
- ✅ Secure HTTPS connection (on Railway)

---

## Need Help?

**Common Issues:**
1. Check file size (< 50MB)
2. Verify PDF is not corrupted
3. Try different browser if issues persist
4. Clear browser cache and retry

**Report Bugs:**
- Open issue on GitHub repository
- Include PDF type and settings used
- Describe expected vs actual behavior

---

**JDT PDF Converter v2.0** - Making PDF extraction powerful and user-friendly! 🚀
