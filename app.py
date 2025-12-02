import os
import io
import logging
import tempfile
import threading
import time
import secrets
import string
import re
from pathlib import Path
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
from flask_wtf.csrf import CSRFProtect

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, continue without it

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching

csrf = CSRFProtect(app)

# Make CSRF token available in templates
@app.context_processor
def inject_csrf_token():
    from flask_wtf.csrf import generate_csrf
    return dict(csrf_token=lambda: generate_csrf())

# Database configuration
# Use PostgreSQL if DATABASE_URL is set (Render), otherwise SQLite for local dev
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # PostgreSQL for production (Render)
    # Handle both postgres:// and postgresql:// schemes
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # SQLite for local development
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///jdt_users.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'index'  # type: ignore[assignment]
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'
login_manager.session_protection = 'strong'  # Protect against session hijacking

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Thread-safe locks
conversion_progress_lock = threading.Lock()
conversion_results_lock = threading.Lock()
file_history_lock = threading.Lock()
credit_operation_lock = threading.Lock()  # New: Prevent race conditions in credit operations

# Store conversion progress with thread safety
conversion_progress = {}
conversion_results = {}
file_history = {}

# Maximum age for tasks in memory (1 hour)
MAX_TASK_AGE = timedelta(hours=1)
task_timestamps = {}

# Email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

# Database Models
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)  # Store password hash
    referral_code = db.Column(db.String(10), unique=True, nullable=False, index=True)
    referred_by_code = db.Column(db.String(10), nullable=True)
    total_credits = db.Column(db.Integer, default=20)  # Starting credits
    used_credits = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    referrals = db.relationship('ReferralLog', foreign_keys='ReferralLog.referrer_id', backref='referrer', lazy='dynamic')
    conversions = db.relationship('Conversion', backref='user', lazy='dynamic')
    
    def get_available_credits(self):
        """Calculate available credits"""
        return max(0, self.total_credits - self.used_credits)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if password matches"""
        return check_password_hash(self.password, password)
    
    @staticmethod
    def generate_referral_code():
        """Generate unique 8-character referral code"""
        chars = string.ascii_uppercase + string.digits
        max_attempts = 100
        for _ in range(max_attempts):
            code = ''.join(secrets.choice(chars) for _ in range(8))
            if not User.query.filter_by(referral_code=code).first():
                return code
        # Fallback to UUID-based code if random generation fails
        return uuid.uuid4().hex[:8].upper()

class ReferralLog(db.Model):
    __tablename__ = 'referral_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    referrer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    referee_email = db.Column(db.String(255), nullable=False)
    signup_date = db.Column(db.DateTime, default=datetime.utcnow)
    credited = db.Column(db.Boolean, default=False)

class Conversion(db.Model):
    __tablename__ = 'conversions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    task_id = db.Column(db.String(100), unique=True, index=True)  # Added index

class CreditTransaction(db.Model):
    __tablename__ = 'credit_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    amount = db.Column(db.Integer, nullable=False)  # Positive for credits added, negative for used
    transaction_type = db.Column(db.String(50), nullable=False)  # 'signup', 'referral', 'purchase', 'daily', 'conversion'
    description = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    balance_after = db.Column(db.Integer, nullable=False)  # Available credits after transaction
    
    # Relationship
    user = db.relationship('User', backref='credit_history')

@login_manager.user_loader
def load_user(user_id):
    """Load user from database and verify session validity"""
    try:
        user = User.query.get(int(user_id))
        # Additional session validation can be added here
        return user
    except Exception as e:
        logger.error(f"Error loading user {user_id}: {e}")
        return None

@login_manager.unauthorized_handler
def unauthorized():
    """Handle unauthorized access attempts"""
    # Check if request is AJAX/API call
    if request.is_json or request.path.startswith('/api/') or request.path.startswith('/upload') or request.path.startswith('/download') or request.path.startswith('/progress') or request.path.startswith('/preview'):
        logger.warning(f"Unauthorized API access attempt: {request.path} from {request.remote_addr}")
        return jsonify({
            'error': 'unauthorized',
            'message': 'You must be logged in to access this resource.',
            'redirect': '/'
        }), 401
    else:
        # For regular page requests, redirect to index
        logger.warning(f"Unauthorized page access attempt: {request.path} from {request.remote_addr}")
        return redirect(url_for('index'))

# Initialize database tables (create if they don't exist)
with app.app_context():
    try:
        db.create_all()
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}", exc_info=True)

# Helper function to log credit transactions
def log_credit_transaction(user, amount, transaction_type, description):
    """Log a credit transaction to the history (caller must commit)"""
    try:
        balance_after = user.get_available_credits()
        transaction = CreditTransaction(  # type: ignore[call-arg]
            user_id=user.id,
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            balance_after=balance_after
        )
        db.session.add(transaction)
        logger.info(f"Credit transaction logged: {user.email} - {amount} - {transaction_type}")
    except Exception as e:
        logger.error(f"Failed to log credit transaction: {e}")
        raise  # Re-raise so caller can handle rollback

def validate_email(email):
    """Validate email format"""
    if not email or len(email) > 255:
        return False
    return EMAIL_REGEX.match(email) is not None

def safe_file_path(base_dir, filename):
    """Ensure file path is within base directory"""
    filepath = os.path.join(base_dir, filename)
    real_base = os.path.realpath(base_dir)
    real_path = os.path.realpath(filepath)
    return real_path.startswith(real_base) and os.path.dirname(real_path) == real_base

from functools import wraps

def require_active_session(f):
    """Enhanced decorator to ensure user has an active, valid session"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated
        if not current_user.is_authenticated:
            logger.warning(f"Unauthenticated access attempt to {request.path} from {request.remote_addr}")
            if request.is_json or request.path.startswith('/api/') or request.path.startswith('/upload'):
                return jsonify({
                    'error': 'unauthorized',
                    'message': 'You must be logged in to access this resource.',
                    'redirect': '/'
                }), 401
            else:
                return redirect(url_for('index'))
        
        # Additional session validation
        try:
            # Verify user still exists in database (not deleted)
            user = User.query.get(current_user.id)
            if not user:
                logger.warning(f"Session for deleted user {current_user.id} detected")
                logout_user()
                session.clear()
                return jsonify({
                    'error': 'session_invalid',
                    'message': 'Your session is no longer valid. Please log in again.',
                    'redirect': '/'
                }), 401
            
            # Check session freshness (optional: can add timestamp validation)
            # This prevents very old sessions from being used
            
        except Exception as e:
            logger.error(f"Session validation error: {e}")
            logout_user()
            session.clear()
            return jsonify({
                'error': 'session_error',
                'message': 'Session validation failed. Please log in again.',
                'redirect': '/'
            }), 401
        
        return f(*args, **kwargs)
    return decorated_function

class PDFConverter:
    @staticmethod
    def parse_page_range(page_range_str, total_pages):
        """Parse page range string and return list of page numbers"""
        if not page_range_str or page_range_str.lower() == "all":
            return list(range(total_pages))
        
        pages = set()
        parts = page_range_str.split(',')
        
        try:
            for part in parts:
                part = part.strip()
                if '-' in part:
                    start, end = part.split('-')
                    start = int(start.strip()) - 1  # Convert to 0-indexed
                    end = int(end.strip())
                    pages.update(range(max(0, start), min(end, total_pages)))
                else:
                    page = int(part.strip()) - 1  # Convert to 0-indexed
                    if 0 <= page < total_pages:
                        pages.add(page)
        except ValueError as e:
            logger.error(f"Invalid page range format: {page_range_str}")
            return list(range(total_pages))  # Default to all pages on error
        
        return sorted(list(pages))
    
    @staticmethod
    def clean_dataframe(df):
        """Clean dataframe by removing empty rows and columns"""
        if df.empty:
            return df
        
        # Remove completely empty rows
        df = df.dropna(how='all')
        
        # Remove completely empty columns
        df = df.dropna(axis=1, how='all')
        
        # Strip whitespace from string columns
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.strip()
        
        return df
    
    @staticmethod
    def convert_pdf(pdf_path, options, task_id):
        """Convert PDF to Excel/CSV with advanced options"""
        try:
            with conversion_progress_lock:
                conversion_progress[task_id] = {'status': 'processing', 'progress': 10}
            
            password = options.get('password', '').strip() or None
            
            # Open PDF with optional password
            with conversion_progress_lock:
                conversion_progress[task_id] = {'status': 'processing', 'progress': 20, 'message': 'Opening PDF...'}
            import pdfplumber  # Fix: Ensure pdfplumber is imported

            try:
                with pdfplumber.open(pdf_path, password=password) as pdf:
                    total_pages = len(pdf.pages)
                    
                    # Parse page range
                    page_range_str = options.get('page_range', 'all')
                    pages_to_extract = PDFConverter.parse_page_range(page_range_str, total_pages)
                    
                    if not pages_to_extract:
                        with conversion_progress_lock:
                            conversion_progress[task_id] = {
                                'status': 'error',
                                'message': 'No valid pages to extract! Please check your page range.',
                                'error_type': 'invalid_range',
                                'suggestion': 'Try using "all" or a valid range like "1-3"'
                            }
                        return None
                    
                    all_tables = []
                    all_text = []
                    extract_mode = options.get('extract_mode', 'tables')
                    
                    # Extract data based on mode
                    with conversion_progress_lock:
                        conversion_progress[task_id] = {
                            'status': 'processing', 
                            'progress': 30, 
                            'message': f'Extracting data from {len(pages_to_extract)} pages...'
                        }
                    
                    progress_increment = 50 / len(pages_to_extract)
                    current_progress = 30
                    
                    for page_idx in pages_to_extract:
                        page = pdf.pages[page_idx]
                    
                        # Extract tables
                        if extract_mode in ["tables", "both"]:
                            tables = page.extract_tables()
                            if tables:
                                for table in tables:
                                    if table and len(table) > 0:
                                        # Check if first row should be header
                                        if options.get('include_headers', True) and len(table) > 1:
                                            import pandas as pd  # Fix: Ensure pandas is imported
                                            df = pd.DataFrame(table[1:], columns=table[0])  # type: ignore[arg-type]
                                        else:
                                            import pandas as pd  # Fix: Ensure pandas is imported
                                            df = pd.DataFrame(table)

                                        # Clean data if option is enabled
                                        if options.get('clean_data', True):
                                            df = PDFConverter.clean_dataframe(df)
                                        
                                        if not df.empty:
                                            all_tables.append(df)
                        
                        # Extract text
                        if extract_mode in ["text", "both"]:
                            text = page.extract_text()
                            if text:
                                all_text.append({
                                    'Page': page_idx + 1,
                                    'Text': text
                                })
                        
                        current_progress += progress_increment
                        with conversion_progress_lock:
                            conversion_progress[task_id] = {
                                'status': 'processing',
                                'progress': min(80, int(current_progress)),
                                'message': f'Processing page {page_idx + 1} of {total_pages}...'
                            }
                
                    # Check if any data was extracted
                    if not all_tables and not all_text:
                        with conversion_progress_lock:
                            conversion_progress[task_id] = {
                                'status': 'error',
                                'message': 'No data found in the PDF!',
                                'error_type': 'no_data',
                                'suggestion': 'This PDF may contain images or scanned content. Try using "text" extraction mode or ensure the PDF has actual text/tables.'
                            }
                        return None
                    
                    # Merge tables if option is enabled
                    if options.get('merge_tables', False) and all_tables:
                        with conversion_progress_lock:
                            conversion_progress[task_id] = {
                                'status': 'processing',
                                'progress': 85,
                                'message': 'Merging tables...'
                            }
                        all_tables = [pd.concat(all_tables, ignore_index=True)]
                    
                    # Save based on format
                    with conversion_progress_lock:
                        conversion_progress[task_id] = {
                            'status': 'processing',
                            'progress': 90,
                            'message': 'Saving file...'
                        }
                    
                    output_format = options.get('output_format', 'xlsx')
                    output_filename = f"converted_{uuid.uuid4().hex[:8]}.{output_format}"
                    output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
                    
                    if output_format == "xlsx":
                        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                            # Write tables
                            for i, table in enumerate(all_tables):
                                sheet_name = f'Table_{i+1}' if not options.get('merge_tables', False) else 'Merged_Data'
                                table.to_excel(writer, sheet_name=sheet_name, index=False)
                            
                            # Write text if extracted
                            if all_text:
                                text_df = pd.DataFrame(all_text)
                                text_df.to_excel(writer, sheet_name='Extracted_Text', index=False)
                    else:  # csv format
                        if all_tables:
                            # For CSV, save the first/merged table
                            all_tables[0].to_csv(output_path, index=False)
                        elif all_text:
                            text_df = pd.DataFrame(all_text)
                            text_df.to_csv(output_path, index=False)
                    
                    # Store preview data (first 50 rows)
                    preview_data = None
                    if all_tables:
                        preview_df = all_tables[0].head(50)
                        # Replace NaN with None for JSON serialization
                        preview_df = preview_df.fillna('')
                        preview_data = {
                            'columns': preview_df.columns.tolist(),
                            'rows': preview_df.values.tolist(),
                            'total_rows': len(all_tables[0])
                        }
                    elif all_text:
                        preview_data = {
                            'text_preview': all_text[:5]  # First 5 pages
                        }
                    
                    with conversion_results_lock:
                        conversion_results[task_id] = {
                            'preview_data': preview_data,
                            'output_path': output_path,
                            'output_filename': output_filename,
                            'timestamp': datetime.now()
                        }
                    
                    # Success
                    with conversion_progress_lock:
                        conversion_progress[task_id] = {
                            'status': 'completed',
                            'progress': 100,
                            'message': 'Conversion completed successfully!',
                            'output_file': output_filename,
                            'table_count': len(all_tables),
                            'text_count': len(all_text),
                            'has_preview': preview_data is not None
                        }
                    
                    return output_path
                    
            except pdfplumber.pdfminer.pdfdocument.PDFPasswordIncorrect:
                logger.error(f"Password incorrect for task {task_id}")
                with conversion_progress_lock:
                    conversion_progress[task_id] = {
                        'status': 'error',
                        'message': 'Incorrect password provided!',
                        'error_type': 'wrong_password',
                        'suggestion': 'Please check your password and try again. The PDF is password-protected.'
                    }
                return None
                    
            except pdfplumber.pdfminer.pdfparser.PDFSyntaxError as e:
                logger.error(f"Corrupted PDF for task {task_id}: {str(e)}")
                with conversion_progress_lock:
                    conversion_progress[task_id] = {
                        'status': 'error',
                        'message': 'The PDF file appears to be corrupted or invalid!',
                        'error_type': 'corrupted_pdf',
                        'suggestion': 'Please try opening the PDF in a PDF reader to verify it\'s not damaged. You may need to repair or re-download the file.'
                    }
                return None
                    
            except PermissionError:
                logger.error(f"Permission denied for task {task_id}")
                with conversion_progress_lock:
                    conversion_progress[task_id] = {
                        'status': 'error',
                        'message': 'Cannot access the PDF file!',
                        'error_type': 'permission_denied',
                        'suggestion': 'The file may be locked by another program. Please close any PDF readers and try again.'
                    }
                return None
                            
        except MemoryError:
            logger.error(f"Memory error for task {task_id}")
            with conversion_progress_lock:
                conversion_progress[task_id] = {
                    'status': 'error',
                    'message': 'PDF file is too large to process!',
                    'error_type': 'memory_error',
                    'suggestion': 'Try processing fewer pages at a time or splitting the PDF into smaller files.'
                }
            return None
        
        except pd.errors.EmptyDataError:
            logger.error(f"Empty data error for task {task_id}")
            with conversion_progress_lock:
                conversion_progress[task_id] = {
                    'status': 'error',
                    'message': 'The extracted data is empty!',
                    'error_type': 'empty_data',
                    'suggestion': 'The PDF may not contain valid table structures. Try switching to "text" extraction mode.'
                }
            return None
        
        except Exception as e:
            logger.error(f"Conversion error for task {task_id}: {str(e)}", exc_info=True)
            error_message = str(e)
            
            # Provide more specific error messages for common issues
            if 'password' in error_message.lower():
                friendly_message = 'This PDF requires a password!'
                suggestion = 'Please enter the PDF password in the "PDF Password" field and try again.'
                error_type = 'password_required'
            elif 'encrypted' in error_message.lower():
                friendly_message = 'This PDF is encrypted!'
                suggestion = 'The PDF is protected. You need to provide the correct password to extract data.'
                error_type = 'encrypted'
            elif 'decode' in error_message.lower() or 'encoding' in error_message.lower():
                friendly_message = 'Unable to decode PDF content!'
                suggestion = 'The PDF may have encoding issues. Try re-saving it with a PDF editor first.'
                error_type = 'encoding_error'
            elif 'timeout' in error_message.lower():
                friendly_message = 'Processing took too long!'
                suggestion = 'The PDF is very complex. Try processing fewer pages or simplifying the document.'
                error_type = 'timeout'
            else:
                friendly_message = f'Conversion failed: {error_message[:100]}'
                suggestion = 'Please check your PDF file and settings, then try again.'
                error_type = 'unknown'
            
            with conversion_progress_lock:
                conversion_progress[task_id] = {
                    'status': 'error',
                    'message': friendly_message,
                    'error_type': error_type,
                    'suggestion': suggestion,
                    'technical_details': error_message if len(error_message) < 200 else error_message[:200] + '...'
                }
            return None
        finally:
            # Always clean up the PDF file
            try:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                    logger.info(f"Cleaned up PDF file: {pdf_path}")
            except Exception as cleanup_error:
                logger.error(f"Cleanup error for {pdf_path}: {cleanup_error}")

@app.route('/')
def index():
    """Render the main page"""
    logger.info("Index page accessed")
    return render_template('index.html')

@app.before_request
def before_request_security():
    """Global security checks before each request"""
    # Skip security checks for static files and public endpoints
    public_endpoints = ['index', 'signup', 'login', 'static', 'get_user_status', 'admin_test', 'test_endpoint', 'admin_check_credits', 'admin_add_credits', 'admin_panel']
    
    if request.endpoint in public_endpoints:
        return None
    
    # For protected endpoints, ensure user is authenticated
    if request.endpoint and not request.endpoint.startswith('static'):
        # Check if this is a protected route (has @login_required)
        protected_routes = [
            'get_credits', 'get_referral_stats', 'get_profile', 'upload_file',
            'get_progress', 'download_file', 'preview_data', 'get_history',
            'get_credit_history', 'logout'
        ]
        
        if request.endpoint in protected_routes:
            if not current_user.is_authenticated:
                logger.warning(f"Blocked unauthenticated request to {request.endpoint} from {request.remote_addr}")
                if request.is_json or request.path.startswith('/api/') or request.path.startswith('/upload'):
                    return jsonify({
                        'error': 'unauthorized',
                        'message': 'Your session has expired. Please log in again.',
                        'redirect': '/'
                    }), 401
                else:
                    return redirect(url_for('index'))
    
    return None

@app.after_request
def after_request_security(response):
    """Add security headers to all responses"""
    # Prevent caching of sensitive data for authenticated routes
    if current_user.is_authenticated:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    
    # Add security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    return response

@app.route('/test-endpoint', methods=['GET', 'POST'])
def test_endpoint():
    """Test endpoint to verify server receives requests"""
    logger.info(f"TEST ENDPOINT HIT - Method: {request.method}")
    return jsonify({'status': 'success', 'message': 'Server is receiving requests!'})

# ==================== Authentication Routes ====================

@app.route('/auth/signup', methods=['POST'])
def signup():
    """Create new user account"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        referral_code = data.get('referral_code', '').strip().upper()
        
        # Validate email
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        if not password:
            return jsonify({'error': 'Password required'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Validate referral code format if provided
        if referral_code and (len(referral_code) != 8 or not referral_code.isalnum()):
            return jsonify({'error': 'Invalid referral code format'}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create new user
        user = User(  # type: ignore[call-arg]
            email=email,
            referral_code=User.generate_referral_code(),
            referred_by_code=referral_code if referral_code else None,
            total_credits=20,
            used_credits=0
        )
        user.set_password(password)
        
        try:
            db.session.add(user)
            db.session.flush()  # Flush to get user.id before logging transaction
            # Log signup bonus before commit for atomic operation
            log_credit_transaction(user, 20, 'signup', 'Welcome bonus - 20 credits')
            db.session.commit()
        except Exception as db_error:
            db.session.rollback()
            logger.error(f"Database error during signup: {db_error}", exc_info=True)
            return jsonify({'error': 'Registration failed. Please try again.'}), 500
        
        # Award referral credits if referred
        if referral_code:
            referrer = User.query.filter_by(referral_code=referral_code).first()
            if referrer and referrer.email != email:
                # Check if not already logged
                existing_log = ReferralLog.query.filter_by(
                    referrer_id=referrer.id,
                    referee_email=email
                ).first()
                
                if not existing_log:
                    try:
                        # Award 10 credits to referrer
                        referrer.total_credits += 10
                        
                        # Log the referral
                        ref_log = ReferralLog(  # type: ignore[call-arg]
                            referrer_id=referrer.id,
                            referee_email=email,
                            credited=True
                        )
                        db.session.add(ref_log)
                        
                        # Log referral transaction before commit
                        log_credit_transaction(referrer, 10, 'referral', f'Referral bonus from {email}')
                        db.session.commit()
                        logger.info(f"Awarded 10 credits to {referrer.email} for referring {email}")
                    except Exception as ref_error:
                        logger.error(f"Error awarding referral credits: {ref_error}")
                        db.session.rollback()
                        # Continue anyway - user is created
        
        # Log user in
        login_user(user, remember=True)
        logger.info(f"New user registered: {email}")
        
        return jsonify({
            'success': True,
            'user': {
                'email': user.email,
                'credits': user.get_available_credits(),
                'referral_code': user.referral_code
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': 'Signup failed'}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    """Login with email and password"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Find user
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Log user in
        login_user(user, remember=True)
        logger.info(f"User logged in: {email}")
        
        return jsonify({
            'success': True,
            'user': {
                'email': user.email,
                'credits': user.get_available_credits(),
                'referral_code': user.referral_code
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Login failed'}), 500

@app.route('/auth/logout', methods=['POST'])
@login_required
def logout():
    """Log user out and invalidate all session data"""
    try:
        email = current_user.email
        user_id = current_user.id
    except:
        email = "unknown"
        user_id = None
    
    # Clear the session and logout
    logout_user()
    session.clear()
    
    # Expire all objects to prevent stale session issues
    db.session.expire_all()
    
    # Remove any cached user data
    if user_id:
        try:
            # Clear any user-specific cache or temporary data
            # This ensures logged-out users cannot access their previous session data
            with conversion_progress_lock:
                # Don't delete progress data, but we could track logged-out sessions
                pass
        except Exception as cache_error:
            logger.warning(f"Error clearing user cache: {cache_error}")
    
    logger.info(f"User logged out successfully: {email}")
    
    # Create response and delete all auth cookies
    response = make_response(jsonify({
        'success': True,
        'message': 'You have been logged out successfully.'
    }), 200)
    
    # Delete remember_token cookie (Flask-Login's remember me cookie)
    response.set_cookie('remember_token', '', expires=0, max_age=0, path='/', httponly=True, samesite='Lax')
    
    # Delete session cookie
    response.set_cookie('session', '', expires=0, max_age=0, path='/', httponly=True, samesite='Lax')
    
    # Add cache control headers to prevent browser caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response

# ==================== Credit & Usage API Routes ====================

@app.route('/api/credits')
@login_required
def get_credits():
    """Get user's credit information"""
    try:
        # Force fresh data from database
        try:
            db.session.expire(current_user)
            db.session.refresh(current_user)
        except:
            pass  # Continue with cached data if refresh fails
        available = current_user.get_available_credits()
        total_referrals = ReferralLog.query.filter_by(
            referrer_id=current_user.id,
            credited=True
        ).count()
        
        total_conversions = Conversion.query.filter_by(
            user_id=current_user.id
        ).count()
        
        return jsonify({
            'available': available,
            'total_earned': current_user.total_credits,
            'used': current_user.used_credits,
            'referrals_count': total_referrals,
            'conversions_count': total_conversions,
            'email': current_user.email,
            'referral_code': current_user.referral_code
        }), 200
        
    except Exception as e:
        logger.error(f"Credits API error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/user-status')
def get_user_status():
    """Get current user status (for frontend checks)"""
    try:
        if current_user.is_authenticated:
            # Force fresh data from database
            try:
                db.session.expire(current_user)
                db.session.refresh(current_user)
            except:
                pass  # Continue with cached data if refresh fails
            return jsonify({
                'logged_in': True,
                'email': current_user.email,
                'available_credits': current_user.get_available_credits(),
                'referral_code': current_user.referral_code
            }), 200
        else:
            return jsonify({'logged_in': False}), 200
    except Exception as e:
        # If anything goes wrong (e.g., during logout), return logged out state
        logger.debug(f"User status check error (likely during logout): {e}")
        return jsonify({'logged_in': False}), 200

@app.route('/api/referral-stats')
@login_required
def get_referral_stats():
    """Get detailed referral statistics"""
    try:
        referrals = ReferralLog.query.filter_by(referrer_id=current_user.id).all()
        
        referral_list = [{
            'email': ref.referee_email,
            'signup_date': ref.signup_date.isoformat(),
            'credited': ref.credited
        } for ref in referrals]
        
        return jsonify({
            'total_referrals': len(referrals),
            'referrals': referral_list,
            'credits_earned_from_referrals': len([r for r in referrals if r.credited]) * 10
        }), 200
        
    except Exception as e:
        logger.error(f"Referral stats error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile')
@login_required
def get_profile():
    """Get user profile information"""
    try:
        # Force fresh data from database
        try:
            db.session.expire(current_user)
            db.session.refresh(current_user)
        except:
            pass  # Continue with cached data if refresh fails
        # Get referral stats
        referrals = ReferralLog.query.filter_by(referrer_id=current_user.id).all()
        total_referrals = len(referrals)
        referral_credits = len([r for r in referrals if r.credited]) * 10
        
        # Get conversions count
        total_conversions = Conversion.query.filter_by(user_id=current_user.id).count()
        
        # Get who referred this user
        referred_by = None
        if current_user.referred_by_code:
            referrer = User.query.filter_by(referral_code=current_user.referred_by_code).first()
            if referrer:
                referred_by = referrer.email
        
        return jsonify({
            'email': current_user.email,
            'referral_code': current_user.referral_code,
            'created_at': current_user.created_at.isoformat(),
            'total_credits': current_user.total_credits,
            'used_credits': current_user.used_credits,
            'available_credits': current_user.get_available_credits(),
            'total_conversions': total_conversions,
            'total_referrals': total_referrals,
            'referral_credits': referral_credits,
            'referred_by': referred_by
        }), 200
        
    except Exception as e:
        logger.error(f"Profile error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Handle file upload and start conversion"""
    filepath = None
    task_id = None
    credit_deducted = False
    
    try:
        # Thread-safe credit check and deduction
        with credit_operation_lock:
            # Refresh user data to prevent race conditions
            db.session.refresh(current_user)
            available_credits = current_user.get_available_credits()
            
            if available_credits < 1:
                return jsonify({
                    'error': 'out_of_credits',
                    'message': 'You have no credits left! Share your referral link to earn more.',
                    'referral_code': current_user.referral_code
                }), 403
            
            # Validate file presence
            if 'pdf_file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400
            
            file = request.files['pdf_file']
            if file.filename == '' or file.filename is None:
                return jsonify({'error': 'No file selected'}), 400
            
            if not file.filename.lower().endswith('.pdf'):
                return jsonify({'error': 'Please upload a PDF file'}), 400
            
            # Validate MIME type
            if file.content_type and file.content_type not in ['application/pdf', 'application/x-pdf']:
                return jsonify({'error': 'Invalid file type. Please upload a PDF file'}), 400
            
            # Validate file size on backend (50MB limit)
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset to beginning
            if file_size > 50 * 1024 * 1024:
                return jsonify({'error': 'File size exceeds 50MB limit'}), 400
            
            if file_size == 0:
                return jsonify({'error': 'File is empty'}), 400
            # Save uploaded file
            from werkzeug.utils import secure_filename

            filename = secure_filename(file.filename or '')
            if not filename:
                filename = 'uploaded.pdf'

            temp_filename = f"{uuid.uuid4().hex}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
            
            # Verify path safety
            if not safe_file_path(app.config['UPLOAD_FOLDER'], temp_filename):
                return jsonify({'error': 'Invalid filename'}), 400
            
            file.save(filepath)
            
            # Deduct credit AFTER file is saved successfully
            current_user.used_credits += 1
            
            # Log credit usage before commit for atomic operation
            log_credit_transaction(current_user, -1, 'conversion', f'PDF conversion: {filename}')
            db.session.commit()
            credit_deducted = True
            logger.info(f"Credit deducted for {current_user.email}. Remaining: {current_user.get_available_credits()}")
        
        # Get conversion options from form
        options = {
            'page_range': request.form.get('page_range', 'all'),
            'extract_mode': request.form.get('extract_mode', 'tables'),
            'merge_tables': request.form.get('merge_tables') == 'true',
            'include_headers': request.form.get('include_headers') == 'true',
            'clean_data': request.form.get('clean_data') == 'true',
            'password': request.form.get('password', ''),
            'output_format': request.form.get('output_format', 'xlsx')
        }
        
        # Generate task ID
        task_id = str(uuid.uuid4())
        with conversion_progress_lock:
            conversion_progress[task_id] = {'status': 'started', 'progress': 0}
            task_timestamps[task_id] = datetime.now()
        
        # Log conversion
        conversion = Conversion(  # type: ignore[call-arg]
            user_id=current_user.id,
            filename=filename,
            task_id=task_id
        )
        db.session.add(conversion)
        db.session.commit()
        
        # Start conversion in background thread
        thread = threading.Thread(
            target=PDFConverter.convert_pdf,
            args=(filepath, options, task_id),
            daemon=True
        )
        thread.start()
        
        return jsonify({
            'task_id': task_id,
            'credits_remaining': current_user.get_available_credits()
        }), 200
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        
        # Refund credit on error if it was deducted
        if credit_deducted:
            try:
                with credit_operation_lock:
                    db.session.refresh(current_user)
                    current_user.used_credits = max(0, current_user.used_credits - 1)
                    log_credit_transaction(current_user, 1, 'refund', f'Refund due to upload error')
                    db.session.commit()
                    logger.info(f"Credit refunded for {current_user.email}")
            except Exception as refund_error:
                logger.error(f"Failed to refund credit: {refund_error}")
        
        # Clean up uploaded file on error
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up file: {cleanup_error}")
        
        # Mark task as failed if task_id was created
        if task_id:
            with conversion_progress_lock:
                conversion_progress[task_id] = {
                    'status': 'error',
                    'message': 'Upload failed. Credit has been refunded.'
                }
        
        return jsonify({'error': str(e)}), 500

@app.route('/progress/<task_id>')
@login_required
def get_progress(task_id):
    """Get conversion progress - only for user's own tasks"""
    try:
        # Verify task belongs to current user
        conversion = Conversion.query.filter_by(task_id=task_id, user_id=current_user.id).first()
        if not conversion:
            return jsonify({'status': 'not_found', 'message': 'Task not found or unauthorized'}), 404
        
        with conversion_progress_lock:
            if task_id in conversion_progress:
                progress_data = conversion_progress[task_id].copy()
                return jsonify(progress_data), 200
            else:
                return jsonify({'status': 'not_found', 'message': 'Task not found'}), 404
                
    except Exception as e:
        logger.error(f"Progress error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    """Download converted file - user-isolated"""
    try:
        # Security: validate filename format
        if not filename or '..' in filename or '/' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        # Find the task that generated this file
        with conversion_progress_lock:
            user_task_id = None
            for task_id, progress_data in conversion_progress.items():
                if progress_data.get('output_file') == filename:
                    # Verify this task belongs to the current user
                    conversion = Conversion.query.filter_by(
                        task_id=task_id,
                        user_id=current_user.id
                    ).first()
                    if conversion:
                        user_task_id = task_id
                        break
            
            if not user_task_id:
                logger.warning(f"Unauthorized download attempt: {current_user.email} tried to access {filename}")
                return jsonify({'error': 'Unauthorized access'}), 403
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Verify path safety
        if not safe_file_path(app.config['UPLOAD_FOLDER'], filename):
            return jsonify({'error': 'Invalid file path'}), 400
        
        if os.path.exists(filepath):
            # Determine MIME type
            if filename.endswith('.xlsx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                download_name = 'converted.xlsx'
            else:
                mimetype = 'text/csv'
                download_name = 'converted.csv'
            
            # Send file and schedule deletion
            def remove_file(path):
                time.sleep(60)  # Wait 60 seconds after download to ensure completion
                try:
                    if os.path.exists(path):
                        os.remove(path)
                        logger.info(f"Successfully deleted temporary file: {path}")
                except Exception as e:
                    logger.warning(f"Failed to delete file {path}: {e}")
            
            threading.Thread(target=remove_file, args=(filepath,), daemon=True).start()
            
            return send_file(
                filepath,
                mimetype=mimetype,
                as_attachment=True,
                download_name=download_name
            )
        else:
            return jsonify({'error': 'File not found'}), 404
            
    except Exception as e:
        logger.error(f"Download error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/preview-data/<task_id>')
@login_required
def preview_data(task_id):
    """Get preview of converted data before download - user-isolated"""
    try:
        # Verify task belongs to current user
        conversion = Conversion.query.filter_by(task_id=task_id, user_id=current_user.id).first()
        if not conversion:
            return jsonify({'error': 'Unauthorized access'}), 403
        
        with conversion_results_lock:
            if task_id not in conversion_results:
                return jsonify({'error': 'Preview data not available'}), 404
            
            result = conversion_results[task_id]
            preview = result.get('preview_data')
            
            if not preview:
                return jsonify({'error': 'No preview data available'}), 404
            
            return jsonify(preview), 200
            
    except Exception as e:
        logger.error(f"Preview error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/history')
@login_required
def get_history():
    """Get user's conversion history"""
    try:
        # Get conversions from database
        conversions = Conversion.query.filter_by(user_id=current_user.id)\
            .order_by(Conversion.timestamp.desc())\
            .limit(50)\
            .all()
        
        history = []
        for conv in conversions:
            task_id = conv.task_id
            
            # Get current status from memory if available
            with conversion_progress_lock:
                progress = conversion_progress.get(task_id, {})
                status = progress.get('status', 'completed')  # Assume completed if not in memory
                output_file = progress.get('output_file')
            
            history.append({
                'task_id': task_id,
                'filename': conv.filename,
                'timestamp': conv.timestamp.isoformat(),
                'status': status,
                'output_file': output_file,
                'can_download': status == 'completed' and output_file is not None
            })
        
        return jsonify({'history': history}), 200
        
    except Exception as e:
        logger.error(f"History error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/admin/test')
def admin_test():
    """Test endpoint to verify deployment and env vars"""
    return jsonify({
        'status': 'ok',
        'admin_key_set': 'ADMIN_KEY' in os.environ,
        'admin_key_length': len(os.environ.get('ADMIN_KEY', '')) if 'ADMIN_KEY' in os.environ else 0
    }), 200

@app.route('/admin/check_credits', methods=['POST'])
@csrf.exempt
def admin_check_credits():
    """Admin endpoint to check user credits - requires admin key"""
    try:
        # Verify admin key
        admin_key = request.json.get('admin_key', '').strip() if request.json else ''  # type: ignore[union-attr]
        expected_key = os.environ.get('ADMIN_KEY', 'your_secure_admin_key_here').strip()
        
        if not admin_key or admin_key != expected_key:
            logger.warning(f"Unauthorized admin check credits attempt")
            return jsonify({'error': 'Unauthorized - Invalid admin key'}), 403
        
        email = request.json.get('email', '').strip().lower() if request.json else ''  # type: ignore[union-attr]
        
        if not email:
            return jsonify({'error': 'Email required'}), 400
        
        # Get user from database
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({'error': f'User {email} not found'}), 404
        
        # Force fresh data
        db.session.refresh(user)
        
        return jsonify({
            'email': user.email,
            'total_credits': user.total_credits,
            'used_credits': user.used_credits,
            'available_credits': user.get_available_credits(),
            'created_at': user.created_at.isoformat() if user.created_at else None
        }), 200
        
    except Exception as e:
        logger.error(f"Check credits error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/admin/add_credits', methods=['POST'])
@csrf.exempt
def admin_add_credits():
    """Admin endpoint to add credits to users - requires admin key"""
    try:
        # Get admin key from request
        admin_key = request.json.get('admin_key', '').strip() if request.json else ''  # type: ignore[union-attr]
        expected_key = os.environ.get('ADMIN_KEY', 'your_secure_admin_key_here').strip()
        
        if not admin_key or admin_key != expected_key:
            logger.warning(f"Unauthorized admin access attempt")
            return jsonify({'error': 'Unauthorized - Invalid admin key'}), 403
        
        email = request.json.get('email') if request.json else None  # type: ignore[union-attr]
        credits = request.json.get('credits', 0) if request.json else 0  # type: ignore[union-attr]
        add_to_all = request.json.get('add_to_all', False) if request.json else False  # type: ignore[union-attr]
        
        if not isinstance(credits, int) or credits == 0:
            return jsonify({'error': 'Invalid credits amount'}), 400
        
        if not email and not add_to_all:
            return jsonify({'error': 'Email or add_to_all required'}), 400
        
        if add_to_all:
            # Add credits to all users
            users = User.query.all()
            updated_users = []
            
            for user in users:
                old_total = user.total_credits
                user.total_credits += credits
                # Log transaction before commit for atomic operation
                log_credit_transaction(user, credits, 'purchase', f'Admin credit purchase - {credits} credits')
                updated_users.append({
                    'email': user.email,
                    'old_total': old_total,
                    'new_total': user.total_credits,
                    'available': user.get_available_credits()
                })
            
            db.session.commit()
            # Expire all cached user objects so logged-in users see updated credits
            db.session.expire_all()
            logger.info(f"Admin added {credits} credits to all {len(users)} users")
            
            return jsonify({
                'success': True,
                'message': f'Added {credits} credits to all {len(users)} users',
                'updated_users': updated_users
            }), 200
        else:
            # Validate email
            if not validate_email(email):
                return jsonify({'error': 'Invalid email format'}), 400
            
            # Add credits to specific user
            user = User.query.filter_by(email=email.lower()).first()
            if not user:
                return jsonify({'error': f'User {email} not found'}), 404
            
            old_total = user.total_credits
            user.total_credits += credits
            
            # Log transaction before commit for atomic operation
            log_credit_transaction(user, credits, 'purchase', f'Admin credit purchase - {credits} credits')
            
            db.session.commit()
            # Expire all cached user objects so logged-in users see updated credits
            db.session.expire_all()
            logger.info(f"Admin added {credits} credits to {email}")
            
            return jsonify({
                'success': True,
                'message': f'Added {credits} credits to {email}',
                'user': {
                    'email': user.email,
                    'old_total': old_total,
                    'new_total': user.total_credits,
                    'available': user.get_available_credits()
                }
            }), 200
            
    except Exception as e:
        logger.error(f"Add credits error: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/credit-history')
@login_required
def get_credit_history():
    """Get user's credit transaction history"""
    try:
        # Force fresh data from database
        try:
            db.session.expire(current_user)
            db.session.refresh(current_user)
        except:
            pass  # Continue with cached data if refresh fails
        transactions = CreditTransaction.query.filter_by(user_id=current_user.id)\
            .order_by(CreditTransaction.timestamp.desc())\
            .limit(50)\
            .all()
        
        history = []
        for t in transactions:
            history.append({
                'id': t.id,
                'amount': t.amount,
                'type': t.transaction_type,
                'description': t.description,
                'balance_after': t.balance_after,
                'timestamp': t.timestamp.isoformat()
            })
        
        return jsonify({
            'history': history,
            'current_balance': current_user.get_available_credits()
        }), 200
        
    except Exception as e:
        logger.error(f"Credit history error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/cleanup')
def cleanup_old_files():
    """Clean up old temporary files and task data"""
    try:
        temp_dir = app.config['UPLOAD_FOLDER']
        now = datetime.now()
        deleted_files = 0
        deleted_tasks = 0
        
        # Clean up old files
        for filename in os.listdir(temp_dir):
            filepath = os.path.join(temp_dir, filename)
            # Delete files older than 1 hour
            if os.path.isfile(filepath):
                try:
                    file_modified = datetime.fromtimestamp(os.path.getmtime(filepath))
                    if now - file_modified > timedelta(hours=1):
                        os.remove(filepath)
                        deleted_files += 1
                except Exception as e:
                    logger.warning(f"Failed to delete old file {filepath}: {e}")
        
        # Clean up old task data to prevent memory leaks
        with conversion_progress_lock:
            tasks_to_remove = []
            for task_id, timestamp in list(task_timestamps.items()):
                if now - timestamp > MAX_TASK_AGE:
                    tasks_to_remove.append(task_id)
            
            for task_id in tasks_to_remove:
                if task_id in conversion_progress:
                    del conversion_progress[task_id]
                if task_id in task_timestamps:
                    del task_timestamps[task_id]
                deleted_tasks += 1
        
        # Clean up old conversion results
        with conversion_results_lock:
            results_to_remove = []
            for task_id, result in list(conversion_results.items()):
                if now - result['timestamp'] > MAX_TASK_AGE:
                    results_to_remove.append(task_id)
            
            for task_id in results_to_remove:
                del conversion_results[task_id]
            
            # Prevent memory leak: limit total stored results to 1000
            if len(conversion_results) > 1000:
                sorted_keys = sorted(conversion_results.keys(), 
                                   key=lambda k: conversion_results[k]['timestamp'])
                for key in sorted_keys[:len(conversion_results) - 1000]:
                    del conversion_results[key]
                    deleted_tasks += 1
        
        logger.info(f"Cleanup: {deleted_files} files, {deleted_tasks} tasks")
        return jsonify({'deleted_files': deleted_files, 'deleted_tasks': deleted_tasks}), 200
        
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

def automatic_cleanup():
    """Background thread for automatic cleanup every 30 minutes"""
    while True:
        time.sleep(1800)  # 30 minutes
        try:
            with app.app_context():
                cleanup_old_files()
                logger.info("Automatic cleanup completed")
        except Exception as e:
            logger.error(f"Automatic cleanup error: {e}", exc_info=True)

@app.route('/admin')
def admin_panel():
    """Render the admin panel interface"""
    return render_template('admin.html')

if __name__ == '__main__':
    # Initialize database
    with app.app_context():
        db.create_all()
        logger.info("Database initialized")
        
        # Add initial credit history for existing users (one-time migration)
        try:
            existing_users = User.query.filter(~User.id.in_(
                db.session.query(CreditTransaction.user_id).distinct()
            )).all()
            
            if existing_users:
                for user in existing_users:
                    transaction = CreditTransaction(
                        user_id=user.id,
                        amount=20,
                        transaction_type='signup',
                        description='Initial signup bonus',
                        balance_after=user.get_available_credits()
                    )
                    db.session.add(transaction)
                db.session.commit()
                logger.info(f"Added signup transactions for {len(existing_users)} existing users")
        except Exception as e:
            logger.warning(f"Credit history migration: {e}")
            db.session.rollback()
    
    # Start automatic cleanup thread
    cleanup_thread = threading.Thread(target=automatic_cleanup, daemon=True)
    cleanup_thread.start()
    logger.info("Automatic cleanup thread started (runs every 30 minutes)")
    
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', debug=debug_mode, port=port)