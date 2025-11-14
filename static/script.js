// Global variables
let currentTaskId = null;
let progressInterval = null;
let downloadFilename = null;

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
const convertAnotherBtn = document.getElementById('convertAnotherBtn');
const tryAgainBtn = document.getElementById('tryAgainBtn');
const dropOverlay = document.getElementById('dropOverlay');

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
});