// Global variables
let currentTaskId = null;
let progressInterval = null;
let downloadFilename = null;
let hasPreviewData = false;

// Settings Templates
const TEMPLATES_KEY = 'jdt_pdf_templates';
const DARK_MODE_KEY = 'jdt_dark_mode';

// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('pdfFile');
const fileName = document.getElementById('fileName');
const fileInfo = document.getElementById('fileInfo');
const convertBtn = document.getElementById('convertBtn');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const statusMessage = document.getElementById('statusMessage');
const resultSection = document.getElementById('resultSection');
const resultDetails = document.getElementById('resultDetails');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const downloadBtn = document.getElementById('downloadBtn');
const previewDataBtn = document.getElementById('previewDataBtn');
const convertAnotherBtn = document.getElementById('convertAnotherBtn');
const tryAgainBtn = document.getElementById('tryAgainBtn');
const dropOverlay = document.getElementById('dropOverlay');

// New UI elements
const darkModeToggle = document.getElementById('darkModeToggle');
const historyBtn = document.getElementById('historyBtn');
const templatesBtn = document.getElementById('templatesBtn');
const templateSelect = document.getElementById('templateSelect');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const previewModal = document.getElementById('previewModal');
const historyModal = document.getElementById('historyModal');
const templateModal = document.getElementById('templateModal');

// File Upload Handling
fileInput.addEventListener('change', function(e) {
    handleFileSelect(e.target.files[0]);
});

function handleFileSelect(file) {
    if (file && file.type === 'application/pdf') {
        // Sanitize filename for display
        const sanitizedName = file.name.replace(/[<>"']/g, '');
        fileName.textContent = sanitizedName;
        fileInfo.textContent = `Size: ${formatFileSize(file.size)}`;
        document.querySelector('.file-upload-label').classList.add('has-file');
    } else if (file) {
        alert('Please select a valid PDF file');
        fileInput.value = '';
        fileName.textContent = 'Choose PDF file or drag & drop here';
        fileInfo.textContent = '';
        document.querySelector('.file-upload-label').classList.remove('has-file');
    }
}

// Drag and Drop
let dragCounter = 0;

document.addEventListener('dragenter', function(e) {
    e.preventDefault();
    dragCounter++;
    dropOverlay.style.display = 'flex';
});

document.addEventListener('dragleave', function(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dropOverlay.style.display = 'none';
    }
});

document.addEventListener('dragover', function(e) {
    e.preventDefault();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.style.display = 'none';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect(files[0]);
    }
});

// Form Submission
uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!fileInput.files[0]) {
        alert('Please select a PDF file');
        return;
    }
    
    // Validate file size (50MB limit)
    if (fileInput.files[0].size > 50 * 1024 * 1024) {
        alert('File size exceeds 50MB limit');
        return;
    }
    
    // Validate page range format
    const pageRange = document.getElementById('pageRange').value.trim();
    if (pageRange && pageRange.toLowerCase() !== 'all') {
        const pageRangeRegex = /^\d+(-\d+)?(,\s*\d+(-\d+)?)*$/;
        if (!pageRangeRegex.test(pageRange)) {
            alert('Invalid page range format. Use "all", "1-3", or "1,3,5"');
            return;
        }
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('pdf_file', fileInput.files[0]);
    formData.append('page_range', document.getElementById('pageRange').value);
    formData.append('extract_mode', document.getElementById('extractMode').value);
    formData.append('output_format', document.getElementById('outputFormat').value);
    formData.append('merge_tables', document.getElementById('mergeTables').checked);
    formData.append('include_headers', document.getElementById('includeHeaders').checked);
    formData.append('clean_data', document.getElementById('cleanData').checked);
    formData.append('password', document.getElementById('password').value);
    
    // Reset UI
    hideAllSections();
    progressSection.style.display = 'block';
    convertBtn.disabled = true;
    progressBar.style.width = '0%';
    statusMessage.textContent = 'Uploading file...';
    
    try {
        // Upload file and start conversion
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        
        const result = await response.json();
        currentTaskId = result.task_id;
        
        // Start monitoring progress
        startProgressMonitoring();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            showError('Upload timed out. Please try again with a smaller file.');
        } else {
            showError(error.message);
        }
        convertBtn.disabled = false;
    }
});

// Progress Monitoring
let progressTimeout = 0;
const MAX_PROGRESS_TIME = 600000; // 10 minutes max

function startProgressMonitoring() {
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    
    const startTime = Date.now();
    
    progressInterval = setInterval(async () => {
        try {
            // Check for timeout
            if (Date.now() - startTime > MAX_PROGRESS_TIME) {
                clearInterval(progressInterval);
                showError('Conversion timed out. Please try again with a smaller file or fewer pages.');
                return;
            }
            
            const response = await fetch(`/progress/${currentTaskId}`);
            if (!response.ok) {
                throw new Error('Failed to get progress');
            }
            
            const progress = await response.json();
            updateProgress(progress);
            
            if (progress.status === 'completed') {
                clearInterval(progressInterval);
                showSuccess(progress);
            } else if (progress.status === 'error') {
                clearInterval(progressInterval);
                showError(progress.message);
            }
            
        } catch (error) {
            clearInterval(progressInterval);
            showError('Failed to monitor progress. The conversion may still be running.');
            convertBtn.disabled = false;
        }
    }, 500);
}

function updateProgress(progress) {
    if (progress.progress) {
        progressBar.style.width = `${progress.progress}%`;
    }
    if (progress.message) {
        statusMessage.textContent = progress.message;
    }
}

// Success Handling
function showSuccess(progress) {
    hideAllSections();
    resultSection.style.display = 'block';
    
    downloadFilename = progress.output_file;
    hasPreviewData = progress.has_preview || false;
    
    // Show preview button if data is available
    if (hasPreviewData) {
        previewDataBtn.style.display = 'inline-flex';
    } else {
        previewDataBtn.style.display = 'none';
    }
    
    // Build result details
    let details = '<div class="result-details">';
    if (progress.table_count > 0) {
        details += `<p><strong>Tables extracted:</strong> ${progress.table_count}</p>`;
    }
    if (progress.text_count > 0) {
        details += `<p><strong>Text pages extracted:</strong> ${progress.text_count}</p>`;
    }
    details += `<p><strong>Output format:</strong> ${downloadFilename.endsWith('.xlsx') ? 'Excel (.xlsx)' : 'CSV (.csv)'}</p>`;
    details += '</div>';
    
    resultDetails.innerHTML = details;
    convertBtn.disabled = false;
}

// Error Handling
function showError(message) {
    hideAllSections();
    errorSection.style.display = 'block';
    errorMessage.textContent = message || 'An unexpected error occurred';
    convertBtn.disabled = false;
}

// Download Handling
downloadBtn.addEventListener('click', function() {
    if (downloadFilename) {
        window.location.href = `/download/${downloadFilename}`;
    }
});

// Reset Functions
convertAnotherBtn.addEventListener('click', resetForm);
tryAgainBtn.addEventListener('click', resetForm);

function resetForm() {
    uploadForm.reset();
    fileInput.value = '';
    fileName.textContent = 'Choose PDF file or drag & drop here';
    fileInfo.textContent = '';
    document.querySelector('.file-upload-label').classList.remove('has-file');
    hideAllSections();
    currentTaskId = null;
    downloadFilename = null;
    if (progressInterval) {
        clearInterval(progressInterval);
    }
}

function hideAllSections() {
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set default values
    document.getElementById('pageRange').value = 'all';
    document.getElementById('includeHeaders').checked = true;
    document.getElementById('cleanData').checked = true;
    
    // Initialize features
    initializeDarkMode();
    loadTemplates();
});

// ============================================================================
// DARK MODE FEATURE
// ============================================================================

function initializeDarkMode() {
    const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

darkModeToggle.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(DARK_MODE_KEY, isDark);
    darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

// ============================================================================
// DATA PREVIEW FEATURE
// ============================================================================

previewDataBtn.addEventListener('click', async function() {
    if (!currentTaskId) return;
    
    try {
        const response = await fetch(`/preview-data/${currentTaskId}`);
        if (!response.ok) {
            throw new Error('Failed to load preview data');
        }
        
        const data = await response.json();
        displayPreviewModal(data);
    } catch (error) {
        alert('Unable to load preview: ' + error.message);
    }
});

function displayPreviewModal(data) {
    const previewContent = document.getElementById('previewContent');
    const infoDiv = previewContent.querySelector('.preview-info');
    const tableWrapper = previewContent.querySelector('.preview-table-wrapper');
    
    if (data.columns && data.rows) {
        // Table data preview
        infoDiv.innerHTML = `<p><strong>Showing first 50 rows</strong> of ${data.total_rows} total rows</p>`;
        
        let tableHTML = '<table class="preview-table"><thead><tr>';
        data.columns.forEach(col => {
            tableHTML += `<th>${escapeHtml(String(col))}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        data.rows.forEach(row => {
            tableHTML += '<tr>';
            row.forEach(cell => {
                tableHTML += `<td>${escapeHtml(String(cell || ''))}</td>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';
        
        tableWrapper.innerHTML = tableHTML;
    } else if (data.text_preview) {
        // Text data preview
        infoDiv.innerHTML = '<p><strong>Text Preview</strong> (first 5 pages)</p>';
        let textHTML = '<div class="text-preview">';
        data.text_preview.forEach(item => {
            textHTML += `<div class="text-page"><strong>Page ${item.Page}:</strong><pre>${escapeHtml(String(item.Text).substring(0, 500))}...</pre></div>`;
        });
        textHTML += '</div>';
        tableWrapper.innerHTML = textHTML;
    }
    
    // Show modal with flex display
    previewModal.style.display = 'flex';
    previewModal.classList.add('active');
}

document.getElementById('closePreviewModal').addEventListener('click', function() {
    previewModal.style.display = 'none';
    previewModal.classList.remove('active');
});

// ============================================================================
// SETTINGS TEMPLATES FEATURE
// ============================================================================

function loadTemplates() {
    const templates = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    templateSelect.innerHTML = '<option value="">Load a template...</option>';
    
    templates.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = template.name;
        templateSelect.appendChild(option);
    });
}

templateSelect.addEventListener('change', function() {
    if (this.value === '') return;
    
    const templates = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    const template = templates[parseInt(this.value)];
    
    if (template) {
        applyTemplate(template.settings);
        this.value = ''; // Reset selection
    }
});

function applyTemplate(settings) {
    document.getElementById('pageRange').value = settings.page_range || 'all';
    document.getElementById('extractMode').value = settings.extract_mode || 'tables';
    document.getElementById('outputFormat').value = settings.output_format || 'xlsx';
    document.getElementById('mergeTables').checked = settings.merge_tables || false;
    document.getElementById('includeHeaders').checked = settings.include_headers !== false;
    document.getElementById('cleanData').checked = settings.clean_data !== false;
}

saveTemplateBtn.addEventListener('click', function() {
    templateModal.style.display = 'flex';
    templateModal.classList.add('active');
    document.getElementById('templateName').value = '';
    document.getElementById('templateName').focus();
});

templatesBtn.addEventListener('click', function() {
    templateModal.style.display = 'flex';
    templateModal.classList.add('active');
    document.getElementById('templateName').value = '';
});

document.getElementById('saveTemplateConfirm').addEventListener('click', function() {
    const name = document.getElementById('templateName').value.trim();
    if (!name) {
        alert('Please enter a template name');
        return;
    }
    
    const settings = {
        page_range: document.getElementById('pageRange').value,
        extract_mode: document.getElementById('extractMode').value,
        output_format: document.getElementById('outputFormat').value,
        merge_tables: document.getElementById('mergeTables').checked,
        include_headers: document.getElementById('includeHeaders').checked,
        clean_data: document.getElementById('cleanData').checked
    };
    
    const templates = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    templates.push({ name, settings });
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    
    loadTemplates();
    templateModal.style.display = 'none';
    templateModal.classList.remove('active');
    
    // Show success message
    const tempMsg = document.createElement('div');
    tempMsg.className = 'toast-message';
    tempMsg.innerHTML = '<i class="fas fa-check"></i> Template saved!';
    document.body.appendChild(tempMsg);
    setTimeout(() => tempMsg.remove(), 3000);
});

document.getElementById('cancelTemplateSave').addEventListener('click', function() {
    templateModal.style.display = 'none';
    templateModal.classList.remove('active');
});

document.getElementById('closeTemplateModal').addEventListener('click', function() {
    templateModal.style.display = 'none';
    templateModal.classList.remove('active');
});

// ============================================================================
// HISTORY FEATURE
// ============================================================================

historyBtn.addEventListener('click', async function() {
    try {
        const response = await fetch('/history');
        if (!response.ok) {
            throw new Error('Failed to load history');
        }
        
        const data = await response.json();
        displayHistoryModal(data.history);
    } catch (error) {
        alert('Unable to load history: ' + error.message);
    }
});

function displayHistoryModal(history) {
    const historyList = document.querySelector('#historyContent .history-list');
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-message">No conversion history yet</p>';
    } else {
        let html = '<div class="history-items">';
        history.reverse().forEach(item => {
            const date = new Date(item.timestamp);
            const statusClass = item.status === 'completed' ? 'success' : item.status === 'error' ? 'error' : 'pending';
            const statusIcon = item.status === 'completed' ? 'check-circle' : item.status === 'error' ? 'exclamation-circle' : 'spinner';
            
            html += `<div class="history-item ${statusClass}">
                <div class="history-header">
                    <span class="history-filename"><i class="fas fa-file-pdf"></i> ${escapeHtml(item.filename)}</span>
                    <span class="history-status"><i class="fas fa-${statusIcon}"></i> ${item.status}</span>
                </div>
                <div class="history-details">
                    <small>${date.toLocaleString()}</small>
                    ${item.can_download ? `<button class="history-download-btn" onclick="downloadHistoryFile('${item.output_file}')"><i class="fas fa-download"></i> Download</button>` : ''}
                </div>
            </div>`;
        });
        html += '</div>';
        historyList.innerHTML = html;
    }
    
    historyModal.style.display = 'flex';
    historyModal.classList.add('active');
}

function downloadHistoryFile(filename) {
    window.location.href = `/download/${filename}`;
}

document.getElementById('closeHistoryModal').addEventListener('click', function() {
    historyModal.style.display = 'none';
    historyModal.classList.remove('active');
});

// Close modals on background click
window.addEventListener('click', function(e) {
    if (e.target === previewModal) {
        previewModal.style.display = 'none';
        previewModal.classList.remove('active');
    }
    if (e.target === historyModal) {
        historyModal.style.display = 'none';
        historyModal.classList.remove('active');
    }
    if (e.target === templateModal) {
        templateModal.style.display = 'none';
        templateModal.classList.remove('active');
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}