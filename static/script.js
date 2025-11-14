// Global variables
let currentTaskId = null;
let progressInterval = null;
let downloadFilename = null;
let hasPreviewData = false;
let currentUser = null;
let userReferralCode = null;

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

// Auth UI elements
const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const creditsBadge = document.getElementById('creditsBadge');
const creditsCount = document.getElementById('creditsCount');
const userMenu = document.getElementById('userMenu');
const userMenuBtn = document.getElementById('userMenuBtn');
const userDropdown = document.getElementById('userDropdown');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const referralBtn = document.getElementById('referralBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const outOfCreditsModal = document.getElementById('outOfCreditsModal');
const closeCreditsModal = document.getElementById('closeCreditsModal');
const referralModal = document.getElementById('referralModal');
const closeReferralModal = document.getElementById('closeReferralModal');

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
            
            // Handle out of credits error
            if (error.error === 'out_of_credits') {
                convertBtn.disabled = false;
                hideAllSections();
                showOutOfCreditsModal();
                return;
            }
            
            throw new Error(error.error || 'Upload failed');
        }
        
        const result = await response.json();
        currentTaskId = result.task_id;
        
        // Update credits display
        if (result.credits_remaining !== undefined) {
            creditsCount.textContent = result.credits_remaining;
        }
        
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
    if (e.target === loginModal) {
        loginModal.style.display = 'none';
        loginModal.classList.remove('active');
    }
    if (e.target === outOfCreditsModal) {
        outOfCreditsModal.style.display = 'none';
        outOfCreditsModal.classList.remove('active');
    }
    if (e.target === referralModal) {
        referralModal.style.display = 'none';
        referralModal.classList.remove('active');
    }
});

// ============================================================================
// AUTHENTICATION & CREDITS SYSTEM
// ============================================================================

// Check user status on page load
async function checkUserStatus() {
    try {
        const response = await fetch('/api/user-status');
        const data = await response.json();
        
        if (data.logged_in) {
            currentUser = data;
            userReferralCode = data.referral_code;
            showLoggedInState(data);
            await updateCreditsDisplay();
        } else {
            showLoggedOutState();
        }
    } catch (error) {
        console.error('Status check error:', error);
        showLoggedOutState();
    }
}

function showLoggedInState(userData) {
    loginBtn.style.display = 'none';
    creditsBadge.style.display = 'flex';
    userMenu.style.display = 'block';
    userEmail.textContent = userData.email;
    creditsCount.textContent = userData.available_credits || 0;
}

function showLoggedOutState() {
    loginBtn.style.display = 'inline-flex';
    creditsBadge.style.display = 'none';
    userMenu.style.display = 'none';
}

async function updateCreditsDisplay() {
    try {
        const response = await fetch('/api/credits');
        if (response.ok) {
            const data = await response.json();
            creditsCount.textContent = data.available;
            currentUser = data;
        }
    } catch (error) {
        console.error('Credits update error:', error);
    }
}

async function showReferralModal() {
    try {
        const response = await fetch('/api/credits');
        const creditsData = await response.json();
        
        const statsResponse = await fetch('/api/referral-stats');
        const statsData = await statsResponse.json();
        
        document.getElementById('availableCredits').textContent = creditsData.available;
        document.getElementById('totalReferrals').textContent = statsData.total_referrals;
        document.getElementById('creditsEarned').textContent = creditsData.total_earned;
        
        const referralLink = `${window.location.origin}/?ref=${creditsData.referral_code}`;
        document.getElementById('dashboardReferralLink').value = referralLink;
        
        // Display referral list
        const referralList = document.getElementById('referralList');
        if (statsData.referrals && statsData.referrals.length > 0) {
            let html = '<div class="referral-items">';
            statsData.referrals.forEach(ref => {
                const date = new Date(ref.signup_date).toLocaleDateString();
                html += `
                    <div class="referral-item">
                        <i class="fas fa-user-check"></i>
                        <span>${ref.email}</span>
                        <span class="referral-date">${date}</span>
                        ${ref.credited ? '<span class="credit-badge">+10 credits</span>' : ''}
                    </div>
                `;
            });
            html += '</div>';
            referralList.innerHTML = html;
        } else {
            referralList.innerHTML = '<p class="no-referrals">No referrals yet. Start sharing!</p>';
        }
        
        referralModal.style.display = 'flex';
        referralModal.classList.add('active');
    } catch (error) {
        console.error('Referral modal error:', error);
    }
}

// Alias for backward compatibility
const showReferralDashboard = showReferralModal;

async function showProfileModal() {
    console.log('showProfileModal called');
    try {
        console.log('Fetching profile data...');
        const response = await fetch('/api/profile');
        console.log('Profile response:', response.status);
        const data = await response.json();
        console.log('Profile data:', data);
        
        // Account information
        document.getElementById('profileEmail').textContent = data.email;
        document.getElementById('profileReferralCode').textContent = data.referral_code;
        
        // Format join date
        const joinDate = new Date(data.created_at);
        document.getElementById('profileJoinDate').textContent = joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Usage statistics
        document.getElementById('profileTotalCredits').textContent = data.total_credits;
        document.getElementById('profileUsedCredits').textContent = data.used_credits;
        document.getElementById('profileAvailableCredits').textContent = data.available_credits;
        document.getElementById('profileTotalConversions').textContent = data.total_conversions;
        
        // Referral performance
        document.getElementById('profileTotalReferrals').textContent = data.total_referrals;
        document.getElementById('profileReferralCredits').textContent = data.referral_credits;
        document.getElementById('profileReferredBy').textContent = data.referred_by || 'None';
        
        // Show modal
        const profileModal = document.getElementById('profileModal');
        console.log('Profile modal element:', profileModal);
        profileModal.style.display = 'flex';
        profileModal.classList.add('active');
        console.log('Profile modal should be visible now');
    } catch (error) {
        console.error('Profile modal error:', error);
        showToast('Failed to load profile');
    }
}


function showOutOfCreditsModal() {
    const referralLink = `${window.location.origin}/?ref=${userReferralCode}`;
    document.getElementById('referralLinkInput').value = referralLink;
    
    outOfCreditsModal.style.display = 'flex';
    outOfCreditsModal.classList.add('active');
}

// Copy referral link handlers
document.getElementById('copyReferralLink').addEventListener('click', function() {
    const input = document.getElementById('referralLinkInput');
    input.select();
    document.execCommand('copy');
    showToast('Referral link copied!');
});

document.getElementById('copyDashboardLink').addEventListener('click', function() {
    const input = document.getElementById('dashboardReferralLink');
    input.select();
    document.execCommand('copy');
    showToast('Referral link copied!');
});

// Social share handlers
function shareOnTwitter(referralCode) {
    const text = `I'm using JDT PDF Converter - it's amazing! Get 3 free conversions with my link:`;
    const url = `${window.location.origin}/?ref=${referralCode}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
}

function shareOnWhatsApp(referralCode) {
    const text = `Check out JDT PDF Converter! Get 3 free conversions: ${window.location.origin}/?ref=${referralCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnLinkedIn(referralCode) {
    const url = `${window.location.origin}/?ref=${referralCode}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
}

document.getElementById('shareTwitter').addEventListener('click', () => shareOnTwitter(userReferralCode));
document.getElementById('shareWhatsApp').addEventListener('click', () => shareOnWhatsApp(userReferralCode));
document.getElementById('dashboardShareTwitter').addEventListener('click', () => shareOnTwitter(currentUser.referral_code));
document.getElementById('dashboardShareWhatsApp').addEventListener('click', () => shareOnWhatsApp(currentUser.referral_code));
document.getElementById('dashboardShareLinkedIn').addEventListener('click', () => shareOnLinkedIn(currentUser.referral_code));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeDarkMode();
    loadTemplates();
    checkUserStatus();
    
    // Setup all authentication event listeners
    setupAuthEventListeners();
    
    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode && !currentUser) {
        // Auto-show login modal with referral code prefilled
        setTimeout(() => {
            const referralInput = document.getElementById('referralCodeInput');
            const modal = document.getElementById('loginModal');
            if (referralInput && modal) {
                referralInput.value = refCode.toUpperCase();
                modal.style.display = 'flex';
                modal.classList.add('active');
            }
        }, 1000);
    }
});

// Setup authentication event listeners
function setupAuthEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const referralBtn = document.getElementById('referralBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const closeCreditsModal = document.getElementById('closeCreditsModal');
    const closeReferralModal = document.getElementById('closeReferralModal');
    const outOfCreditsModal = document.getElementById('outOfCreditsModal');
    const referralModal = document.getElementById('referralModal');
    
    // Login button handler
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref');
            if (refCode) {
                document.getElementById('loginReferralCode').value = refCode.toUpperCase();
            }
            loginModal.style.display = 'flex';
            loginModal.classList.add('active');
            // Reset to login mode
            setAuthMode('login');
        });
    }
    
    // Close login modal
    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', function() {
            loginModal.style.display = 'none';
            loginModal.classList.remove('active');
            document.getElementById('authError').style.display = 'none';
        });
    }
    
    // Toggle between login and signup
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    let currentAuthMode = 'login';
    
    function setAuthMode(mode) {
        currentAuthMode = mode;
        const submitBtn = document.getElementById('loginSubmitBtn');
        const modalHeader = document.querySelector('#loginModal .modal-header h2');
        const passwordConfirmGroup = document.getElementById('signupPasswordConfirmGroup');
        const referralCodeGroup = document.getElementById('referralCodeGroup');
        
        if (mode === 'signup') {
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            modalHeader.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            toggleAuthMode.textContent = 'Already have an account? Login';
            passwordConfirmGroup.style.display = 'block';
            referralCodeGroup.style.display = 'block';
        } else {
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            modalHeader.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Continue';
            toggleAuthMode.textContent = 'Don\'t have an account? Sign up';
            passwordConfirmGroup.style.display = 'none';
            referralCodeGroup.style.display = 'none';
        }
        document.getElementById('authError').style.display = 'none';
    }
    
    if (toggleAuthMode) {
        toggleAuthMode.addEventListener('click', function(e) {
            e.preventDefault();
            setAuthMode(currentAuthMode === 'login' ? 'signup' : 'login');
        });
    }
    
    // Handle login/signup form submission
    const authForm = document.getElementById('loginForm');
    if (authForm) {
        authForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('authError');
            const submitBtn = document.getElementById('loginSubmitBtn');
            
            // Validation
            if (!email || !password) {
                errorDiv.textContent = 'Please enter email and password';
                errorDiv.style.display = 'block';
                return;
            }
            
            if (currentAuthMode === 'signup') {
                const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
                if (password !== passwordConfirm) {
                    errorDiv.textContent = 'Passwords do not match';
                    errorDiv.style.display = 'block';
                    return;
                }
                if (password.length < 6) {
                    errorDiv.textContent = 'Password must be at least 6 characters';
                    errorDiv.style.display = 'block';
                    return;
                }
            }
            
            // Disable button during request
            submitBtn.disabled = true;
            submitBtn.textContent = currentAuthMode === 'signup' ? 'Creating account...' : 'Logging in...';
            errorDiv.style.display = 'none';
            
            try {
                const endpoint = currentAuthMode === 'signup' ? '/auth/signup' : '/auth/login';
                const payload = {
                    email: email,
                    password: password
                };
                
                if (currentAuthMode === 'signup') {
                    const referralCode = document.getElementById('loginReferralCode').value.trim().toUpperCase();
                    if (referralCode) {
                        payload.referral_code = referralCode;
                    }
                }
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Success - reload page
                    window.location.reload();
                } else {
                    // Show error
                    errorDiv.textContent = data.error || 'Authentication failed';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Auth error:', error);
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            } finally {
                // Re-enable button
                submitBtn.disabled = false;
                setAuthMode(currentAuthMode); // Reset button text
            }
        });
    }
    
    // User menu dropdown toggle
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', function() {
            userDropdown.classList.remove('show');
        });
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                await fetch('/auth/logout', {method: 'POST'});
                window.location.reload();
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
    
    // Referral button
    if (referralBtn) {
        referralBtn.addEventListener('click', function() {
            showReferralDashboard();
        });
    }
    
    // Profile button
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            console.log('Profile button clicked');
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown) userDropdown.classList.remove('show');
            showProfileModal();
        });
    } else {
        console.log('Profile button not found');
    }
    
    // Dashboard button
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', function() {
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown) userDropdown.classList.remove('show');
            showReferralDashboard();
        });
    }
    
    // Close modals
    if (closeCreditsModal && outOfCreditsModal) {
        closeCreditsModal.addEventListener('click', function() {
            outOfCreditsModal.style.display = 'none';
            outOfCreditsModal.classList.remove('active');
        });
    }
    
    if (closeReferralModal && referralModal) {
        closeReferralModal.addEventListener('click', function() {
            referralModal.style.display = 'none';
            referralModal.classList.remove('active');
        });
    }
    
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileModal = document.getElementById('profileModal');
    if (closeProfileModal && profileModal) {
        closeProfileModal.addEventListener('click', function() {
            profileModal.style.display = 'none';
            profileModal.classList.remove('active');
        });
    }
    
    // Click outside modal to close
    window.addEventListener('click', function(e) {
        if (e.target === referralModal) {
            referralModal.style.display = 'none';
            referralModal.classList.remove('active');
        }
        if (e.target === profileModal) {
            profileModal.style.display = 'none';
            profileModal.classList.remove('active');
        }
        if (e.target === outOfCreditsModal) {
            outOfCreditsModal.style.display = 'none';
            outOfCreditsModal.classList.remove('active');
        }
    });
    
    // View referrals from profile
    const viewReferralsBtn = document.getElementById('viewReferralsBtn');
    if (viewReferralsBtn) {
        viewReferralsBtn.addEventListener('click', function() {
            profileModal.style.display = 'none';
            showReferralDashboard();
        });
    }
    
    // Copy profile referral code
    const copyProfileReferralCode = document.getElementById('copyProfileReferralCode');
    if (copyProfileReferralCode) {
        copyProfileReferralCode.addEventListener('click', function() {
            const codeElement = document.getElementById('profileReferralCode');
            if (codeElement) {
                navigator.clipboard.writeText(codeElement.textContent).then(() => {
                    copyProfileReferralCode.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyProfileReferralCode.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                });
            }
        });
    }
}
// Copy UPI ID function
function copyUPI() {
    const upiId = 'jerinad123@pingpay';
    navigator.clipboard.writeText(upiId).then(() => {
        const btn = event.target.closest('button');
        const icon = btn.querySelector('i');
        icon.className = 'fas fa-check';
        btn.style.color = '#4caf50';
        setTimeout(() => {
            icon.className = 'fas fa-copy';
            btn.style.color = '';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy UPI ID');
    });
}

// Load credit history
async function loadCreditHistory() {
    try {
        const response = await fetch('/api/credit-history');
        if (!response.ok) throw new Error('Failed to load credit history');
        
        const data = await response.json();
        const historyList = document.getElementById('creditHistoryList');
        
        if (data.history.length === 0) {
            historyList.innerHTML = `
                <div class="no-history">
                    <i class="fas fa-inbox"></i>
                    <p>No credit history yet</p>
                </div>
            `;
            return;
        }
        
        historyList.innerHTML = '';
        data.history.forEach(item => {
            const isPositive = item.amount > 0;
            const typeClass = isPositive ? 'credit-added' : 'credit-used';
            const amountClass = isPositive ? 'positive' : 'negative';
            const icon = getTransactionIcon(item.type);
            const date = new Date(item.timestamp).toLocaleString();
            
            const historyItem = document.createElement('div');
            historyItem.className = credit-history-item ;
            historyItem.innerHTML = 
                <div class=\""history-info\"">
                    <div class=\""history-type\""><i class=\""\""></i> </div>
                    <div class=\""history-description\""></div>
                    <div class=\""history-date\""></div>
                </div>
                <div class=\""history-amount\"">
                    <div class=\""amount-value \""></div>
                    <div class=\""history-balance\"">Balance: </div>
                </div>
            ;
            historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error('Error loading credit history:', error);
        document.getElementById('creditHistoryList').innerHTML = 
            <div class=\""loading-message\"">Failed to load history</div>
        ;
    }
}

function getTransactionIcon(type) {
    const icons = {
        'signup': 'fas fa-user-plus',
        'referral': 'fas fa-gift',
        'purchase': 'fas fa-shopping-cart',
        'daily': 'fas fa-calendar-day',
        'conversion': 'fas fa-file-pdf'
    };
    return icons[type] || 'fas fa-coin';
}

// Load credit history when profile modal opens
document.getElementById('profileBtn')?.addEventListener('click', () => {
    loadCreditHistory();
});
