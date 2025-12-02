// ============================================================================
// JDT PDF CONVERTER - FRONTEND JAVASCRIPT
// Version: 2.0 (Bug-Fixed)
// Last Updated: November 15, 2025
// ============================================================================

(function () {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        TEMPLATES_KEY: 'jdt_pdf_templates',
        DARK_MODE_KEY: 'jdt_dark_mode',
        MAX_TEMPLATE_SIZE: 100000, // 100KB limit for localStorage
        MAX_TEMPLATES: 20,
        MAX_PROGRESS_TIME: 600000, // 10 minutes
        PROGRESS_CHECK_INTERVAL: 500, // 500ms
        UPLOAD_TIMEOUT: 60000, // 60 seconds
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        UPI_ID: 'jerinad123@pingpay' // Centralized configuration
    };

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    const state = {
        currentTaskId: null,
        progressInterval: null,
        downloadFilename: null,
        hasPreviewData: false,
        currentUser: null,
        userReferralCode: null,
        currentAuthMode: 'login',
        isCheckingStatus: false // Prevent race conditions
    };

    // ========================================================================
    // DOM ELEMENTS - Cached for performance
    // ========================================================================

    const elements = {
        // Form elements
        uploadForm: null,
        fileInput: null,
        fileName: null,
        fileInfo: null,
        convertBtn: null,

        // Status sections
        progressSection: null,
        progressBar: null,
        statusMessage: null,
        resultSection: null,
        resultDetails: null,
        errorSection: null,
        errorMessage: null,

        // Action buttons
        downloadBtn: null,
        previewDataBtn: null,
        convertAnotherBtn: null,
        tryAgainBtn: null,

        // UI elements
        dropOverlay: null,
        darkModeToggle: null,
        historyBtn: null,
        templatesBtn: null,
        templateSelect: null,
        saveTemplateBtn: null,

        // Modals
        previewModal: null,
        historyModal: null,
        templateModal: null,
        loginModal: null,
        outOfCreditsModal: null,
        referralModal: null,
        profileModal: null,

        // Auth elements
        loginBtn: null,
        creditsBadge: null,
        creditsCount: null,
        userMenu: null,
        userMenuBtn: null,
        userDropdown: null,
        userEmail: null
    };

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Escape HTML to prevent XSS attacks
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        const icon = type === 'success' ? 'check' : type === 'error' ? 'exclamation-circle' : 'info-circle';
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Format file size in human-readable format
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Modern clipboard copy (replaces deprecated execCommand)
     */
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    return true;
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        } catch (err) {
            console.error('Copy failed:', err);
            return false;
        }
    }

    /**
     * Sanitize template name
     */
    function sanitizeTemplateName(name) {
        return name.replace(/[<>"'&]/g, '').trim().substring(0, 50);
    }

    /**
     * Validate email format
     */
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Get transaction icon based on type
     */
    function getTransactionIcon(type) {
        const icons = {
            'signup': 'fas fa-user-plus',
            'referral': 'fas fa-gift',
            'purchase': 'fas fa-shopping-cart',
            'daily': 'fas fa-calendar-day',
            'conversion': 'fas fa-file-pdf',
            'refund': 'fas fa-undo'
        };
        return icons[type] || 'fas fa-coins';
    }

    /**
     * Get CSRF token from meta tag
     */
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    }

    /**
     * Initialize all DOM element references
     */
    function initializeElements() {
        // Form elements
        elements.uploadForm = document.getElementById('uploadForm');
        elements.fileInput = document.getElementById('pdfFile');
        elements.fileName = document.getElementById('fileName');
        elements.fileInfo = document.getElementById('fileInfo');
        elements.convertBtn = document.getElementById('convertBtn');

        // Status sections
        elements.progressSection = document.getElementById('progressSection');
        elements.progressBar = document.getElementById('progressBar');
        elements.statusMessage = document.getElementById('statusMessage');
        elements.resultSection = document.getElementById('resultSection');
        elements.resultDetails = document.getElementById('resultDetails');
        elements.errorSection = document.getElementById('errorSection');
        elements.errorMessage = document.getElementById('errorMessage');

        // Action buttons
        elements.downloadBtn = document.getElementById('downloadBtn');
        elements.previewDataBtn = document.getElementById('previewDataBtn');
        elements.convertAnotherBtn = document.getElementById('convertAnotherBtn');
        elements.tryAgainBtn = document.getElementById('tryAgainBtn');

        // UI elements
        elements.dropOverlay = document.getElementById('dropOverlay');
        elements.darkModeToggle = document.getElementById('darkModeToggle');
        elements.historyBtn = document.getElementById('historyBtn');
        elements.templatesBtn = document.getElementById('templatesBtn');
        elements.templateSelect = document.getElementById('templateSelect');
        elements.saveTemplateBtn = document.getElementById('saveTemplateBtn');

        // Modals
        elements.previewModal = document.getElementById('previewModal');
        elements.historyModal = document.getElementById('historyModal');
        elements.templateModal = document.getElementById('templateModal');
        elements.loginModal = document.getElementById('loginModal');
        elements.outOfCreditsModal = document.getElementById('outOfCreditsModal');
        elements.referralModal = document.getElementById('referralModal');
        elements.profileModal = document.getElementById('profileModal');

        // Auth elements
        elements.loginBtn = document.getElementById('loginBtn');
        elements.creditsBadge = document.getElementById('creditsBadge');
        elements.creditsCount = document.getElementById('creditsCount');
        elements.userMenu = document.getElementById('userMenu');
        elements.userMenuBtn = document.getElementById('userMenuBtn');
        elements.userDropdown = document.getElementById('userDropdown');
        elements.userEmail = document.getElementById('userEmail');
    }

    // ========================================================================
    // FILE UPLOAD HANDLING
    // ========================================================================

    function handleFileSelect(file) {
        if (!file) return;

        if (file.type !== 'application/pdf') {
            showToast('Please select a valid PDF file', 'error');
            resetFileInput();
            return;
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            showToast('File size exceeds 50MB limit', 'error');
            resetFileInput();
            return;
        }

        if (file.size === 0) {
            showToast('File is empty', 'error');
            resetFileInput();
            return;
        }

        const sanitizedName = escapeHtml(file.name);
        elements.fileName.textContent = sanitizedName;
        elements.fileInfo.textContent = `Size: ${formatFileSize(file.size)}`;
        document.querySelector('.file-upload-label')?.classList.add('has-file');
    }

    function resetFileInput() {
        if (elements.fileInput) {
            elements.fileInput.value = '';
        }
        if (elements.fileName) {
            elements.fileName.textContent = 'Choose PDF file or drag & drop here';
        }
        if (elements.fileInfo) {
            elements.fileInfo.textContent = '';
        }
        document.querySelector('.file-upload-label')?.classList.remove('has-file');
    }

    // ========================================================================
    // DRAG AND DROP
    // ========================================================================

    let dragCounter = 0;

    function setupDragAndDrop() {
        document.addEventListener('dragenter', function (e) {
            e.preventDefault();
            dragCounter++;
            if (elements.dropOverlay) {
                elements.dropOverlay.style.display = 'flex';
            }
        });

        document.addEventListener('dragleave', function (e) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0 && elements.dropOverlay) {
                elements.dropOverlay.style.display = 'none';
            }
        });

        document.addEventListener('dragover', function (e) {
            e.preventDefault();
        });

        document.addEventListener('drop', function (e) {
            e.preventDefault();
            dragCounter = 0;
            if (elements.dropOverlay) {
                elements.dropOverlay.style.display = 'none';
            }

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                elements.fileInput.files = files;
                handleFileSelect(files[0]);
            }
        });
    }

    // ========================================================================
    // FORM SUBMISSION
    // ========================================================================

    async function handleFormSubmit(e) {
        e.preventDefault();

        if (!elements.fileInput?.files[0]) {
            showToast('Please select a PDF file', 'error');
            return;
        }

        // Validate file size
        if (elements.fileInput.files[0].size > CONFIG.MAX_FILE_SIZE) {
            showToast('File size exceeds 50MB limit', 'error');
            return;
        }

        // Validate page range format
        const pageRange = document.getElementById('pageRange')?.value?.trim() || '';
        if (pageRange && pageRange.toLowerCase() !== 'all') {
            const pageRangeRegex = /^\d+(-\d+)?(,\s*\d+(-\d+)?)*$/;
            if (!pageRangeRegex.test(pageRange)) {
                showToast('Invalid page range format. Use "all", "1-3", or "1,3,5"', 'error');
                return;
            }
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('pdf_file', elements.fileInput.files[0]);
        formData.append('page_range', document.getElementById('pageRange')?.value || 'all');
        formData.append('extract_mode', document.getElementById('extractMode')?.value || 'tables');
        formData.append('output_format', document.getElementById('outputFormat')?.value || 'xlsx');
        formData.append('merge_tables', document.getElementById('mergeTables')?.checked || false);
        formData.append('include_headers', document.getElementById('includeHeaders')?.checked !== false);
        formData.append('clean_data', document.getElementById('cleanData')?.checked !== false);
        formData.append('password', document.getElementById('password')?.value || '');

        // Reset UI
        hideAllSections();
        if (elements.progressSection) elements.progressSection.style.display = 'block';
        if (elements.convertBtn) elements.convertBtn.disabled = true;
        if (elements.progressBar) elements.progressBar.style.width = '0%';
        if (elements.statusMessage) elements.statusMessage.textContent = 'Uploading file...';

        try {
            // Upload file with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.UPLOAD_TIMEOUT);

            const response = await fetch('/upload', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                },
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json();

                // Handle out of credits error
                if (error.error === 'out_of_credits') {
                    if (elements.convertBtn) elements.convertBtn.disabled = false;
                    hideAllSections();
                    showOutOfCreditsModal();
                    return;
                }

                throw new Error(error.error || 'Upload failed');
            }

            const result = await response.json();
            state.currentTaskId = result.task_id;

            // Update credits display
            if (result.credits_remaining !== undefined && elements.creditsCount) {
                elements.creditsCount.textContent = result.credits_remaining;
            }

            // Start monitoring progress
            startProgressMonitoring();

        } catch (error) {
            if (error.name === 'AbortError') {
                showError('Upload timed out. Please try again with a smaller file.');
            } else {
                showError(error.message);
            }
            if (elements.convertBtn) elements.convertBtn.disabled = false;
        }
    }

    // ========================================================================
    // PROGRESS MONITORING
    // ========================================================================

    function startProgressMonitoring() {
        // Clear any existing interval
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }

        const startTime = Date.now();
        let consecutiveErrors = 0;
        const MAX_ERRORS = 5;

        state.progressInterval = setInterval(async () => {
            try {
                // Check for timeout
                if (Date.now() - startTime > CONFIG.MAX_PROGRESS_TIME) {
                    clearInterval(state.progressInterval);
                    state.progressInterval = null;
                    showError('Conversion timed out. Please try again with a smaller file or fewer pages.');
                    return;
                }

                const response = await fetch(`/progress/${state.currentTaskId}`);

                if (!response.ok) {
                    consecutiveErrors++;
                    if (consecutiveErrors >= MAX_ERRORS) {
                        throw new Error('Failed to get progress after multiple attempts');
                    }
                    return; // Try again on next interval
                }

                consecutiveErrors = 0; // Reset error counter on success
                const progress = await response.json();
                updateProgress(progress);

                if (progress.status === 'completed') {
                    clearInterval(state.progressInterval);
                    state.progressInterval = null;
                    showSuccess(progress);
                } else if (progress.status === 'error') {
                    clearInterval(state.progressInterval);
                    state.progressInterval = null;
                    // Pass full progress object for detailed error info
                    showError(progress.message, progress);
                }

            } catch (error) {
                clearInterval(state.progressInterval);
                state.progressInterval = null;
                showError('Failed to monitor progress. The conversion may still be running.');
                if (elements.convertBtn) elements.convertBtn.disabled = false;
            }
        }, CONFIG.PROGRESS_CHECK_INTERVAL);
    }

    function updateProgress(progress) {
        if (progress.progress && elements.progressBar) {
            elements.progressBar.style.width = `${progress.progress}%`;
        }
        if (progress.message && elements.statusMessage) {
            elements.statusMessage.textContent = progress.message;
        }
    }

    // ========================================================================
    // RESULT HANDLING
    // ========================================================================

    function showSuccess(progress) {
        hideAllSections();
        if (elements.resultSection) {
            elements.resultSection.style.display = 'block';
        }

        state.downloadFilename = progress.output_file;
        state.hasPreviewData = progress.has_preview || false;

        // Show preview button if data is available
        if (elements.previewDataBtn) {
            elements.previewDataBtn.style.display = state.hasPreviewData ? 'inline-flex' : 'none';
        }

        // Build result details
        let details = '<div class="result-details">';
        if (progress.table_count > 0) {
            details += `<p><strong>Tables extracted:</strong> ${progress.table_count}</p>`;
        }
        if (progress.text_count > 0) {
            details += `<p><strong>Text pages extracted:</strong> ${progress.text_count}</p>`;
        }
        const format = state.downloadFilename?.endsWith('.xlsx') ? 'Excel (.xlsx)' : 'CSV (.csv)';
        details += `<p><strong>Output format:</strong> ${format}</p>`;
        details += '</div>';

        if (elements.resultDetails) {
            elements.resultDetails.innerHTML = details;
        }
        if (elements.convertBtn) {
            elements.convertBtn.disabled = false;
        }
    }

    function showError(message, errorData) {
        hideAllSections();
        if (elements.errorSection) {
            elements.errorSection.style.display = 'block';
        }

        // Build comprehensive error display
        let errorHTML = `<p class="error-main-message">${escapeHtml(message || 'An unexpected error occurred')}</p>`;

        // Add suggestion if available
        if (errorData && errorData.suggestion) {
            errorHTML += `
                <div class="error-suggestion">
                    <i class="fas fa-lightbulb"></i>
                    <strong>Suggestion:</strong> ${escapeHtml(errorData.suggestion)}
                </div>
            `;
        }

        // Add error type badge if available
        if (errorData && errorData.error_type) {
            const errorTypeLabels = {
                'invalid_range': 'Invalid Page Range',
                'no_data': 'No Data Found',
                'wrong_password': 'Incorrect Password',
                'corrupted_pdf': 'Corrupted PDF',
                'permission_denied': 'Permission Denied',
                'memory_error': 'File Too Large',
                'empty_data': 'Empty Data',
                'password_required': 'Password Required',
                'encrypted': 'Encrypted PDF',
                'encoding_error': 'Encoding Error',
                'timeout': 'Timeout',
                'unknown': 'Error'
            };
            const errorLabel = errorTypeLabels[errorData.error_type] || 'Error';
            errorHTML += `<div class="error-type-badge">${escapeHtml(errorLabel)}</div>`;
        }

        // Add technical details if available (for advanced users)
        if (errorData && errorData.technical_details) {
            errorHTML += `
                <details class="error-technical-details">
                    <summary>Technical Details</summary>
                    <pre>${escapeHtml(errorData.technical_details)}</pre>
                </details>
            `;
        }

        if (elements.errorMessage) {
            elements.errorMessage.innerHTML = errorHTML;
        }

        if (elements.convertBtn) {
            elements.convertBtn.disabled = false;
        }
    }

    function hideAllSections() {
        if (elements.progressSection) elements.progressSection.style.display = 'none';
        if (elements.resultSection) elements.resultSection.style.display = 'none';
        if (elements.errorSection) elements.errorSection.style.display = 'none';
    }

    // ========================================================================
    // RESET FORM
    // ========================================================================

    function resetForm() {
        elements.uploadForm?.reset();
        resetFileInput();
        hideAllSections();
        state.currentTaskId = null;
        state.downloadFilename = null;
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
            state.progressInterval = null;
        }
    }

    // ========================================================================
    // DARK MODE
    // ========================================================================

    function initializeDarkMode() {
        const isDarkMode = localStorage.getItem(CONFIG.DARK_MODE_KEY) === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            if (elements.darkModeToggle) {
                elements.darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        }
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem(CONFIG.DARK_MODE_KEY, isDark);
        if (elements.darkModeToggle) {
            elements.darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }
    }

    // ========================================================================
    // TEMPLATES
    // ========================================================================

    function loadTemplates() {
        try {
            const templatesJson = localStorage.getItem(CONFIG.TEMPLATES_KEY) || '[]';
            const templates = JSON.parse(templatesJson);

            if (!elements.templateSelect) return;

            elements.templateSelect.innerHTML = '<option value="">Load a template...</option>';

            templates.forEach((template, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = escapeHtml(template.name);
                elements.templateSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    }

    function applyTemplate(settings) {
        const pageRange = document.getElementById('pageRange');
        const extractMode = document.getElementById('extractMode');
        const outputFormat = document.getElementById('outputFormat');
        const mergeTables = document.getElementById('mergeTables');
        const includeHeaders = document.getElementById('includeHeaders');
        const cleanData = document.getElementById('cleanData');

        if (pageRange) pageRange.value = settings.page_range || 'all';
        if (extractMode) extractMode.value = settings.extract_mode || 'tables';
        if (outputFormat) outputFormat.value = settings.output_format || 'xlsx';
        if (mergeTables) mergeTables.checked = settings.merge_tables || false;
        if (includeHeaders) includeHeaders.checked = settings.include_headers !== false;
        if (cleanData) cleanData.checked = settings.clean_data !== false;
    }

    function saveTemplate(name, settings) {
        try {
            const templatesJson = localStorage.getItem(CONFIG.TEMPLATES_KEY) || '[]';
            const templates = JSON.parse(templatesJson);

            // Check limits
            if (templates.length >= CONFIG.MAX_TEMPLATES) {
                showToast('Maximum number of templates reached. Please delete some first.', 'error');
                return false;
            }

            const templateData = JSON.stringify({ name, settings });
            if (templateData.length > CONFIG.MAX_TEMPLATE_SIZE) {
                showToast('Template is too large to save', 'error');
                return false;
            }

            templates.push({ name, settings });
            localStorage.setItem(CONFIG.TEMPLATES_KEY, JSON.stringify(templates));
            return true;
        } catch (error) {
            console.error('Failed to save template:', error);
            showToast('Failed to save template', 'error');
            return false;
        }
    }

    // ========================================================================
    // PREVIEW MODAL
    // ========================================================================

    async function showPreviewData() {
        if (!state.currentTaskId) return;

        try {
            const response = await fetch(`/preview-data/${state.currentTaskId}`);
            if (!response.ok) {
                throw new Error('Failed to load preview data');
            }

            const data = await response.json();
            displayPreviewModal(data);
        } catch (error) {
            showToast('Unable to load preview: ' + error.message, 'error');
        }
    }

    function displayPreviewModal(data) {
        const previewContent = document.getElementById('previewContent');
        if (!previewContent) return;

        const infoDiv = previewContent.querySelector('.preview-info');
        const tableWrapper = previewContent.querySelector('.preview-table-wrapper');

        if (data.columns && data.rows) {
            // Table data preview
            if (infoDiv) {
                infoDiv.innerHTML = `<p><strong>Showing first 50 rows</strong> of ${data.total_rows} total rows</p>`;
            }

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

            if (tableWrapper) {
                tableWrapper.innerHTML = tableHTML;
            }
        } else if (data.text_preview) {
            // Text data preview
            if (infoDiv) {
                infoDiv.innerHTML = '<p><strong>Text Preview</strong> (first 5 pages)</p>';
            }
            let textHTML = '<div class="text-preview">';
            data.text_preview.forEach(item => {
                const pageNum = escapeHtml(String(item.Page));
                const text = escapeHtml(String(item.Text).substring(0, 500));
                textHTML += `<div class="text-page"><strong>Page ${pageNum}:</strong><pre>${text}...</pre></div>`;
            });
            textHTML += '</div>';
            if (tableWrapper) {
                tableWrapper.innerHTML = textHTML;
            }
        }

        if (elements.previewModal) {
            elements.previewModal.style.display = 'flex';
            elements.previewModal.classList.add('active');
        }
    }

    // ========================================================================
    // HISTORY MODAL
    // ========================================================================

    async function showHistoryModal() {
        try {
            const response = await fetch('/history');
            if (!response.ok) {
                throw new Error('Failed to load history');
            }

            const data = await response.json();
            displayHistoryModal(data.history);
        } catch (error) {
            showToast('Unable to load history: ' + error.message, 'error');
        }
    }

    function displayHistoryModal(history) {
        const historyList = document.querySelector('#historyContent .history-list');
        if (!historyList) return;

        if (history.length === 0) {
            historyList.innerHTML = '<p class="empty-message">No conversion history yet</p>';
        } else {
            let html = '<div class="history-items">';
            history.reverse().forEach(item => {
                const date = new Date(item.timestamp);
                const statusClass = item.status === 'completed' ? 'success' :
                    item.status === 'error' ? 'error' : 'pending';
                const statusIcon = item.status === 'completed' ? 'check-circle' :
                    item.status === 'error' ? 'exclamation-circle' : 'spinner';
                const filename = escapeHtml(item.filename);
                const status = escapeHtml(item.status);

                html += `<div class="history-item ${statusClass}">
                    <div class="history-header">
                        <span class="history-filename"><i class="fas fa-file-pdf"></i> ${filename}</span>
                        <span class="history-status"><i class="fas fa-${statusIcon}"></i> ${status}</span>
                    </div>
                    <div class="history-details">
                        <small>${date.toLocaleString()}</small>
                        ${item.can_download && item.output_file ?
                        `<button class="history-download-btn" data-filename="${escapeHtml(item.output_file)}">
                            <i class="fas fa-download"></i> Download
                          </button>` : ''}
                    </div>
                </div>`;
            });
            html += '</div>';
            historyList.innerHTML = html;

            // Add event listeners to download buttons
            historyList.querySelectorAll('.history-download-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const filename = this.getAttribute('data-filename');
                    if (filename) {
                        window.location.href = `/download/${filename}`;
                    }
                });
            });
        }

        if (elements.historyModal) {
            elements.historyModal.style.display = 'flex';
            elements.historyModal.classList.add('active');
        }
    }

    // ========================================================================
    // AUTHENTICATION
    // ========================================================================

    async function checkUserStatus() {
        // Prevent race conditions
        if (state.isCheckingStatus) return;
        state.isCheckingStatus = true;

        try {
            const response = await fetch('/api/user-status');
            const data = await response.json();

            if (data.logged_in) {
                state.currentUser = data;
                state.userReferralCode = data.referral_code;
                showLoggedInState(data);
                await updateCreditsDisplay();
            } else {
                showLoggedOutState();
            }
        } catch (error) {
            console.error('Status check error:', error);
            showLoggedOutState();
        } finally {
            state.isCheckingStatus = false;
        }
    }

    function showLoggedInState(userData) {
        if (elements.loginBtn) elements.loginBtn.style.display = 'none';
        if (elements.creditsBadge) elements.creditsBadge.style.display = 'flex';
        if (elements.userMenu) elements.userMenu.style.display = 'block';
        if (elements.userEmail) elements.userEmail.textContent = userData.email;
        if (elements.creditsCount) elements.creditsCount.textContent = userData.available_credits || 0;
    }

    function showLoggedOutState() {
        if (elements.loginBtn) elements.loginBtn.style.display = 'inline-flex';
        if (elements.creditsBadge) elements.creditsBadge.style.display = 'none';
        if (elements.userMenu) elements.userMenu.style.display = 'none';
    }

    async function updateCreditsDisplay() {
        try {
            // Add timestamp to bypass cache
            const response = await fetch(`/api/credits?_=${Date.now()}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (elements.creditsCount) {
                    elements.creditsCount.textContent = data.available;
                }
                state.currentUser = data;
            }
        } catch (error) {
            console.error('Credits update error:', error);
        }
    }

    function setAuthMode(mode) {
        state.currentAuthMode = mode;
        const submitBtn = document.getElementById('loginSubmitBtn');
        const modalHeader = document.querySelector('#loginModal .modal-header h2');
        const passwordConfirmGroup = document.getElementById('signupPasswordConfirmGroup');
        const referralCodeGroup = document.getElementById('referralCodeGroup');
        const toggleAuthMode = document.getElementById('toggleAuthMode');

        if (!submitBtn || !modalHeader) return;

        if (mode === 'signup') {
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            modalHeader.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            if (toggleAuthMode) toggleAuthMode.textContent = 'Already have an account? Login';
            if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';
            if (referralCodeGroup) referralCodeGroup.style.display = 'block';
        } else {
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            modalHeader.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Continue';
            if (toggleAuthMode) toggleAuthMode.textContent = 'Don\'t have an account? Sign up';
            if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'none';
            if (referralCodeGroup) referralCodeGroup.style.display = 'none';
        }

        const authError = document.getElementById('authError');
        if (authError) authError.style.display = 'none';
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;
        const errorDiv = document.getElementById('authError');
        const submitBtn = document.getElementById('loginSubmitBtn');

        // Validation
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Please enter email and password';
                errorDiv.style.display = 'block';
            }
            return;
        }

        if (!isValidEmail(email)) {
            if (errorDiv) {
                errorDiv.textContent = 'Please enter a valid email address';
                errorDiv.style.display = 'block';
            }
            return;
        }

        if (state.currentAuthMode === 'signup') {
            const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value;
            if (password !== passwordConfirm) {
                if (errorDiv) {
                    errorDiv.textContent = 'Passwords do not match';
                    errorDiv.style.display = 'block';
                }
                return;
            }
            if (password.length < 6) {
                if (errorDiv) {
                    errorDiv.textContent = 'Password must be at least 6 characters';
                    errorDiv.style.display = 'block';
                }
                return;
            }
        }

        // Disable button during request
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = state.currentAuthMode === 'signup' ? 'Creating account...' : 'Logging in...';
        }
        if (errorDiv) errorDiv.style.display = 'none';

        try {
            const endpoint = state.currentAuthMode === 'signup' ? '/auth/signup' : '/auth/login';
            const payload = { email, password };

            if (state.currentAuthMode === 'signup') {
                const referralCode = document.getElementById('loginReferralCode')?.value?.trim()?.toUpperCase();
                if (referralCode) {
                    payload.referral_code = referralCode;
                }
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                window.location.reload();
            } else {
                if (errorDiv) {
                    errorDiv.textContent = data.error || 'Authentication failed';
                    errorDiv.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Auth error:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                setAuthMode(state.currentAuthMode);
            }
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                credentials: 'same-origin'
            });

            if (response.ok) {
                // Successfully logged out, redirect to home
                window.location.href = '/';
            } else {
                console.error('Logout failed with status:', response.status);
                // Still reload to clear client state
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Even on error, redirect to clear client state
            window.location.href = '/';
        }
    }

    // ========================================================================
    // REFERRAL & PROFILE
    // ========================================================================

    function showOutOfCreditsModal() {
        if (!state.userReferralCode) return;

        const referralLink = `${window.location.origin}/?ref=${state.userReferralCode}`;
        const input = document.getElementById('referralLinkInput');
        if (input) input.value = referralLink;

        if (elements.outOfCreditsModal) {
            elements.outOfCreditsModal.style.display = 'flex';
            elements.outOfCreditsModal.classList.add('active');
        }
    }

    async function showReferralModal() {
        try {
            const [creditsResponse, statsResponse] = await Promise.all([
                fetch('/api/credits'),
                fetch('/api/referral-stats')
            ]);

            const creditsData = await creditsResponse.json();
            const statsData = await statsResponse.json();

            const availableCredits = document.getElementById('availableCredits');
            const totalReferrals = document.getElementById('totalReferrals');
            const creditsEarned = document.getElementById('creditsEarned');
            const referralLink = document.getElementById('dashboardReferralLink');

            if (availableCredits) availableCredits.textContent = creditsData.available;
            if (totalReferrals) totalReferrals.textContent = statsData.total_referrals;
            if (creditsEarned) creditsEarned.textContent = creditsData.total_earned;
            if (referralLink) {
                referralLink.value = `${window.location.origin}/?ref=${creditsData.referral_code}`;
            }

            // Display referral list
            const referralList = document.getElementById('referralList');
            if (referralList) {
                if (statsData.referrals && statsData.referrals.length > 0) {
                    let html = '<div class="referral-items">';
                    statsData.referrals.forEach(ref => {
                        const date = new Date(ref.signup_date).toLocaleDateString();
                        const email = escapeHtml(ref.email);
                        html += `
                            <div class="referral-item">
                                <i class="fas fa-user-check"></i>
                                <span>${email}</span>
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
            }

            if (elements.referralModal) {
                elements.referralModal.style.display = 'flex';
                elements.referralModal.classList.add('active');
            }
        } catch (error) {
            console.error('Referral modal error:', error);
            showToast('Failed to load referral data', 'error');
        }
    }

    async function showProfileModal() {
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Failed to load profile');
            }

            const data = await response.json();

            // Account information
            const profileEmail = document.getElementById('profileEmail');
            const profileReferralCode = document.getElementById('profileReferralCode');
            const profileJoinDate = document.getElementById('profileJoinDate');

            if (profileEmail) profileEmail.textContent = data.email;
            if (profileReferralCode) profileReferralCode.textContent = data.referral_code;

            if (profileJoinDate && data.created_at) {
                const joinDate = new Date(data.created_at);
                profileJoinDate.textContent = joinDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            // Usage statistics
            const profileTotalCredits = document.getElementById('profileTotalCredits');
            const profileUsedCredits = document.getElementById('profileUsedCredits');
            const profileAvailableCredits = document.getElementById('profileAvailableCredits');
            const profileTotalConversions = document.getElementById('profileTotalConversions');

            if (profileTotalCredits) profileTotalCredits.textContent = data.total_credits;
            if (profileUsedCredits) profileUsedCredits.textContent = data.used_credits;
            if (profileAvailableCredits) profileAvailableCredits.textContent = data.available_credits;
            if (profileTotalConversions) profileTotalConversions.textContent = data.total_conversions;

            // Referral performance
            const profileTotalReferrals = document.getElementById('profileTotalReferrals');
            const profileReferralCredits = document.getElementById('profileReferralCredits');
            const profileReferredBy = document.getElementById('profileReferredBy');

            if (profileTotalReferrals) profileTotalReferrals.textContent = data.total_referrals;
            if (profileReferralCredits) profileReferralCredits.textContent = data.referral_credits;
            if (profileReferredBy) profileReferredBy.textContent = data.referred_by || 'None';

            // Load credit history
            await loadCreditHistory();

            // Show modal
            if (elements.profileModal) {
                elements.profileModal.style.display = 'flex';
                elements.profileModal.classList.add('active');
            }
        } catch (error) {
            console.error('Profile modal error:', error);
            showToast(error.message || 'Failed to load profile', 'error');
        }
    }

    async function loadCreditHistory() {
        try {
            const response = await fetch('/api/credit-history');
            if (!response.ok) throw new Error('Failed to load credit history');

            const data = await response.json();
            const historyList = document.getElementById('creditHistoryList');

            if (!historyList) return;

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
                const amountClass = isPositive ? 'positive' : 'negative';
                const icon = getTransactionIcon(item.type);
                const date = new Date(item.timestamp).toLocaleString();

                const historyItem = document.createElement('div');
                historyItem.className = 'credit-history-item';
                historyItem.innerHTML = `
                    <div class="history-info">
                        <div class="history-type"><i class="${icon}"></i> ${escapeHtml(item.type)}</div>
                        <div class="history-description">${escapeHtml(item.description)}</div>
                        <div class="history-date">${date}</div>
                    </div>
                    <div class="history-amount">
                        <div class="amount-value ${amountClass}">${isPositive ? '+' : ''}${item.amount}</div>
                        <div class="history-balance">Balance: ${item.balance_after}</div>
                    </div>
                `;
                historyList.appendChild(historyItem);
            });
        } catch (error) {
            console.error('Error loading credit history:', error);
            const historyList = document.getElementById('creditHistoryList');
            if (historyList) {
                historyList.innerHTML = '<div class="loading-message">Failed to load history</div>';
            }
        }
    }

    // ========================================================================
    // SOCIAL SHARING
    // ========================================================================

    function shareOnTwitter(referralCode) {
        const text = "I'm using JDT PDF Converter - it's amazing! Get free conversions with my link:";
        const url = `${window.location.origin}/?ref=${referralCode}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    }

    function shareOnWhatsApp(referralCode) {
        const text = `Check out JDT PDF Converter! Get free conversions: ${window.location.origin}/?ref=${referralCode}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }

    function shareOnLinkedIn(referralCode) {
        const url = `${window.location.origin}/?ref=${referralCode}`;
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    }

    // ========================================================================
    // UPI COPY FUNCTION
    // ========================================================================

    async function copyUPI() {
        const success = await copyToClipboard(CONFIG.UPI_ID);
        if (success) {
            showToast('UPI ID copied to clipboard!');
        } else {
            showToast('Failed to copy UPI ID', 'error');
        }
    }

    // ========================================================================
    // MODAL MANAGEMENT
    // ========================================================================

    function closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    function setupModalListeners() {
        // Close buttons
        const closeButtons = [
            { id: 'closePreviewModal', modal: elements.previewModal },
            { id: 'closeHistoryModal', modal: elements.historyModal },
            { id: 'closeTemplateModal', modal: elements.templateModal },
            { id: 'closeLoginModal', modal: elements.loginModal },
            { id: 'closeCreditsModal', modal: elements.outOfCreditsModal },
            { id: 'closeReferralModal', modal: elements.referralModal },
            { id: 'closeProfileModal', modal: elements.profileModal }
        ];

        closeButtons.forEach(({ id, modal }) => {
            const btn = document.getElementById(id);
            if (btn && modal) {
                btn.addEventListener('click', () => closeModal(modal));
            }
        });

        // Click outside to close
        window.addEventListener('click', function (e) {
            const modals = [
                elements.previewModal,
                elements.historyModal,
                elements.templateModal,
                elements.loginModal,
                elements.outOfCreditsModal,
                elements.referralModal,
                elements.profileModal
            ];

            modals.forEach(modal => {
                if (e.target === modal) {
                    closeModal(modal);
                }
            });
        });

        // Keyboard: Escape to close modals
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                const modals = [
                    elements.previewModal,
                    elements.historyModal,
                    elements.templateModal,
                    elements.loginModal,
                    elements.outOfCreditsModal,
                    elements.referralModal,
                    elements.profileModal
                ];

                modals.forEach(modal => {
                    if (modal && modal.classList.contains('active')) {
                        closeModal(modal);
                    }
                });
            }
        });
    }

    // ========================================================================
    // EVENT LISTENERS SETUP (Called once on initialization)
    // ========================================================================

    function setupEventListeners() {
        // File upload
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (e) => {
                handleFileSelect(e.target.files[0]);
            });
        }

        // Form submission
        if (elements.uploadForm) {
            elements.uploadForm.addEventListener('submit', handleFormSubmit);
        }

        // Action buttons
        if (elements.downloadBtn) {
            elements.downloadBtn.addEventListener('click', () => {
                if (state.downloadFilename) {
                    window.location.href = `/download/${state.downloadFilename}`;
                }
            });
        }

        if (elements.previewDataBtn) {
            elements.previewDataBtn.addEventListener('click', showPreviewData);
        }

        if (elements.convertAnotherBtn) {
            elements.convertAnotherBtn.addEventListener('click', resetForm);
        }

        if (elements.tryAgainBtn) {
            elements.tryAgainBtn.addEventListener('click', resetForm);
        }

        // Dark mode toggle
        if (elements.darkModeToggle) {
            elements.darkModeToggle.addEventListener('click', toggleDarkMode);
        }

        // History button
        if (elements.historyBtn) {
            elements.historyBtn.addEventListener('click', showHistoryModal);
        }

        // Template buttons
        if (elements.templateSelect) {
            elements.templateSelect.addEventListener('change', function () {
                if (this.value === '') return;

                try {
                    const templates = JSON.parse(localStorage.getItem(CONFIG.TEMPLATES_KEY) || '[]');
                    const template = templates[parseInt(this.value)];
                    if (template) {
                        applyTemplate(template.settings);
                        this.value = '';
                    }
                } catch (error) {
                    console.error('Error loading template:', error);
                }
            });
        }

        if (elements.saveTemplateBtn) {
            elements.saveTemplateBtn.addEventListener('click', () => {
                if (elements.templateModal) {
                    elements.templateModal.style.display = 'flex';
                    elements.templateModal.classList.add('active');
                }
                const templateNameInput = document.getElementById('templateName');
                if (templateNameInput) {
                    templateNameInput.value = '';
                    templateNameInput.focus();
                }
            });
        }

        const saveTemplateConfirm = document.getElementById('saveTemplateConfirm');
        if (saveTemplateConfirm) {
            saveTemplateConfirm.addEventListener('click', () => {
                const nameInput = document.getElementById('templateName');
                const name = sanitizeTemplateName(nameInput?.value || '');

                if (!name) {
                    showToast('Please enter a template name', 'error');
                    return;
                }

                const settings = {
                    page_range: document.getElementById('pageRange')?.value || 'all',
                    extract_mode: document.getElementById('extractMode')?.value || 'tables',
                    output_format: document.getElementById('outputFormat')?.value || 'xlsx',
                    merge_tables: document.getElementById('mergeTables')?.checked || false,
                    include_headers: document.getElementById('includeHeaders')?.checked !== false,
                    clean_data: document.getElementById('cleanData')?.checked !== false
                };

                if (saveTemplate(name, settings)) {
                    loadTemplates();
                    closeModal(elements.templateModal);
                    showToast('Template saved!');
                }
            });
        }

        const cancelTemplateSave = document.getElementById('cancelTemplateSave');
        if (cancelTemplateSave) {
            cancelTemplateSave.addEventListener('click', () => {
                closeModal(elements.templateModal);
            });
        }

        // Auth event listeners
        setupAuthEventListeners();

        // Modal listeners
        setupModalListeners();

        // Copy buttons
        const copyReferralLink = document.getElementById('copyReferralLink');
        if (copyReferralLink) {
            copyReferralLink.addEventListener('click', async () => {
                const input = document.getElementById('referralLinkInput');
                if (input) {
                    const success = await copyToClipboard(input.value);
                    if (success) showToast('Referral link copied!');
                }
            });
        }

        const copyDashboardLink = document.getElementById('copyDashboardLink');
        if (copyDashboardLink) {
            copyDashboardLink.addEventListener('click', async () => {
                const input = document.getElementById('dashboardReferralLink');
                if (input) {
                    const success = await copyToClipboard(input.value);
                    if (success) showToast('Referral link copied!');
                }
            });
        }

        const copyProfileReferralCode = document.getElementById('copyProfileReferralCode');
        if (copyProfileReferralCode) {
            copyProfileReferralCode.addEventListener('click', async () => {
                const codeElement = document.getElementById('profileReferralCode');
                if (codeElement) {
                    const success = await copyToClipboard(codeElement.textContent);
                    if (success) {
                        copyProfileReferralCode.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            copyProfileReferralCode.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 2000);
                    }
                }
            });
        }

        // Social share buttons
        const shareButtons = [
            { id: 'shareTwitter', handler: () => shareOnTwitter(state.userReferralCode) },
            { id: 'shareWhatsApp', handler: () => shareOnWhatsApp(state.userReferralCode) },
            { id: 'dashboardShareTwitter', handler: () => shareOnTwitter(state.currentUser?.referral_code) },
            { id: 'dashboardShareWhatsApp', handler: () => shareOnWhatsApp(state.currentUser?.referral_code) },
            { id: 'dashboardShareLinkedIn', handler: () => shareOnLinkedIn(state.currentUser?.referral_code) }
        ];

        shareButtons.forEach(({ id, handler }) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        });

        // Copy UPI button
        const copyUpiBtn = document.getElementById('copyUpiBtn');
        if (copyUpiBtn) {
            copyUpiBtn.addEventListener('click', copyUPI);
        }

        // View referrals from profile
        const viewReferralsBtn = document.getElementById('viewReferralsBtn');
        if (viewReferralsBtn) {
            viewReferralsBtn.addEventListener('click', () => {
                closeModal(elements.profileModal);
                showReferralModal();
            });
        }
    }

    function setupAuthEventListeners() {
        // Login button
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const refCode = urlParams.get('ref');
                const referralInput = document.getElementById('loginReferralCode');
                if (refCode && referralInput) {
                    referralInput.value = refCode.toUpperCase();
                }
                if (elements.loginModal) {
                    elements.loginModal.style.display = 'flex';
                    elements.loginModal.classList.add('active');
                }
                setAuthMode('login');
            });
        }

        // Toggle between login and signup
        const toggleAuthMode = document.getElementById('toggleAuthMode');
        if (toggleAuthMode) {
            toggleAuthMode.addEventListener('click', (e) => {
                e.preventDefault();
                setAuthMode(state.currentAuthMode === 'login' ? 'signup' : 'login');
            });
        }

        // Auth form submission
        const authForm = document.getElementById('loginForm');
        if (authForm) {
            authForm.addEventListener('submit', handleAuthSubmit);
        }

        // User menu dropdown
        if (elements.userMenuBtn && elements.userDropdown) {
            elements.userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.userDropdown.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                elements.userDropdown.classList.remove('show');
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Referral button
        const referralBtn = document.getElementById('referralBtn');
        if (referralBtn) {
            referralBtn.addEventListener('click', showReferralModal);
        }

        // Dashboard button
        const dashboardBtn = document.getElementById('dashboardBtn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => {
                if (elements.userDropdown) {
                    elements.userDropdown.classList.remove('show');
                }
                showReferralModal();
            });
        }

        // Profile button
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                if (elements.userDropdown) {
                    elements.userDropdown.classList.remove('show');
                }
                showProfileModal();
            });
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    function initialize() {
        // Initialize DOM elements
        initializeElements();

        // Set default form values
        const pageRange = document.getElementById('pageRange');
        const includeHeaders = document.getElementById('includeHeaders');
        const cleanData = document.getElementById('cleanData');

        if (pageRange) pageRange.value = 'all';
        if (includeHeaders) includeHeaders.checked = true;
        if (cleanData) cleanData.checked = true;

        // Initialize features
        initializeDarkMode();
        loadTemplates();
        checkUserStatus();

        // Setup all event listeners
        setupEventListeners();
        setupDragAndDrop();

        // Check for referral code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode && !state.currentUser) {
            setTimeout(() => {
                const referralInput = document.getElementById('loginReferralCode');
                if (referralInput && elements.loginModal) {
                    referralInput.value = refCode.toUpperCase();
                    elements.loginModal.style.display = 'flex';
                    elements.loginModal.classList.add('active');
                }
            }, 1000);
        }
    }

    // ========================================================================
    // START APPLICATION
    // ========================================================================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Performance optimization: Remove will-change after animations complete
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.querySelector('.container');
        if (container) {
            setTimeout(() => {
                container.classList.add('loaded');
            }, 500); // Match animation duration
        }

        // Add loaded class to modal content after opening
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class') {
                        const modalContent = modal.querySelector('.modal-content');
                        if (modal.classList.contains('active') && modalContent) {
                            setTimeout(() => {
                                modalContent.classList.add('loaded');
                            }, 300);
                        } else if (modalContent) {
                            modalContent.classList.remove('loaded');
                        }
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        });
    });

    // Force refresh credits when page becomes visible
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && state.currentUser) {
            updateCreditsDisplay();
        }
    });

    // Also refresh when window gains focus
    window.addEventListener('focus', function () {
        if (state.currentUser) {
            updateCreditsDisplay();
        }
    });

    // Auto-refresh credits every 30 seconds when logged in
    setInterval(function () {
        if (state.currentUser) {
            updateCreditsDisplay();
        }
    }, 30000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (state.progressInterval) {
            clearInterval(state.progressInterval);
        }
    });

})();