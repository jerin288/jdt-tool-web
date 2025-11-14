import os
import io
import logging
import tempfile
import threading
import time
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, session
from werkzeug.utils import secure_filename
import pandas as pd
import pdfplumber
import uuid
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store conversion progress with thread safety
conversion_progress = {}
conversion_progress_lock = threading.Lock()

# Maximum age for tasks in memory (1 hour)
MAX_TASK_AGE = timedelta(hours=1)
task_timestamps = {}
task_timestamps = {}

class PDFConverter:
    @staticmethod
    def parse_page_range(page_range_str, total_pages):
        """Parse page range string and return list of page numbers"""
        if page_range_str.lower() == "all":
            return list(range(total_pages))
        
        pages = set()
        parts = page_range_str.split(',')
        
        for part in parts:
            if '-' in part:
                start, end = part.split('-')
                start = int(start.strip()) - 1  # Convert to 0-indexed
                end = int(end.strip())
                pages.update(range(max(0, start), min(end, total_pages)))
            else:
                page = int(part.strip()) - 1  # Convert to 0-indexed
                if 0 <= page < total_pages:
                    pages.add(page)
        
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
            conversion_progress[task_id] = {'status': 'processing', 'progress': 10}
            
            password = options.get('password', '').strip() or None
            
            # Open PDF with optional password
            conversion_progress[task_id] = {'status': 'processing', 'progress': 20, 'message': 'Opening PDF...'}
            with pdfplumber.open(pdf_path, password=password) as pdf:
                total_pages = len(pdf.pages)
                
                # Parse page range
                page_range_str = options.get('page_range', 'all')
                pages_to_extract = PDFConverter.parse_page_range(page_range_str, total_pages)
                
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
                
                progress_increment = 50 / len(pages_to_extract) if pages_to_extract else 50
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
                                        df = pd.DataFrame(table[1:], columns=table[0])
                                    else:
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
                            'message': 'No data found in the PDF!'
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
                
                # Success
                with conversion_progress_lock:
                    conversion_progress[task_id] = {
                        'status': 'completed',
                        'progress': 100,
                        'message': 'Conversion completed successfully!',
                        'output_file': output_filename,
                        'table_count': len(all_tables),
                        'text_count': len(all_text)
                    }
                
                return output_path
                
        except Exception as e:
            logger.error(f"Conversion error: {str(e)}", exc_info=True)
            with conversion_progress_lock:
                conversion_progress[task_id] = {
                    'status': 'error',
                    'message': f'An error occurred during conversion: {str(e)}'
                }
            # Clean up the PDF file on error
            try:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
            except Exception as cleanup_error:
                logger.error(f"Cleanup error: {cleanup_error}")
            return None

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and start conversion"""
    try:
        if 'pdf_file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['pdf_file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Please upload a PDF file'}), 400
        
        # Validate MIME type
        if file.content_type and file.content_type not in ['application/pdf', 'application/x-pdf']:
            return jsonify({'error': 'Invalid file type. Please upload a PDF file'}), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        temp_filename = f"{uuid.uuid4().hex}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        file.save(filepath)
        
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
        
        # Start conversion in background thread
        thread = threading.Thread(
            target=PDFConverter.convert_pdf,
            args=(filepath, options, task_id)
        )
        thread.start()
        
        # Clean up uploaded file after conversion
        def cleanup():
            time.sleep(2)  # Wait for conversion to start
            thread.join(timeout=300)  # Wait max 5 minutes
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as e:
                logger.warning(f"Failed to clean up uploaded file {filepath}: {e}")
        
        cleanup_thread = threading.Thread(target=cleanup)
        cleanup_thread.start()
        
        return jsonify({'task_id': task_id}), 200
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/progress/<task_id>')
def get_progress(task_id):
    """Get conversion progress"""
    with conversion_progress_lock:
        if task_id in conversion_progress:
            progress_data = conversion_progress[task_id].copy()
    
    if task_id in conversion_progress:
        return jsonify(progress_data)
    else:
        return jsonify({'status': 'not_found', 'message': 'Task not found'}), 404

@app.route('/download/<filename>')
def download_file(filename):
    """Download converted file"""
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
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
                time.sleep(30)  # Wait 30 seconds after download to ensure completion
                try:
                    if os.path.exists(path):
                        os.remove(path)
                        logger.info(f"Successfully deleted temporary file: {path}")
                except Exception as e:
                    logger.warning(f"Failed to delete file {path}: {e}")
            
            threading.Thread(target=remove_file, args=(filepath,)).start()
            
            return send_file(
                filepath,
                mimetype=mimetype,
                as_attachment=True,
                download_name=download_name
            )
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/cleanup')
def cleanup_old_files():
    """Clean up old temporary files and task data (can be called periodically)"""
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
                file_modified = datetime.fromtimestamp(os.path.getmtime(filepath))
                if now - file_modified > timedelta(hours=1):
                    try:
                        os.remove(filepath)
                        deleted_files += 1
                    except Exception as e:
                        logger.warning(f"Failed to delete old file {filepath}: {e}")
        
        # Clean up old task data to prevent memory leaks
        with conversion_progress_lock:
            tasks_to_remove = []
            for task_id, timestamp in task_timestamps.items():
                if now - timestamp > MAX_TASK_AGE:
                    tasks_to_remove.append(task_id)
            
            for task_id in tasks_to_remove:
                if task_id in conversion_progress:
                    del conversion_progress[task_id]
                if task_id in task_timestamps:
                    del task_timestamps[task_id]
                deleted_tasks += 1
        
        return jsonify({'deleted_files': deleted_files, 'deleted_tasks': deleted_tasks}), 200
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', debug=False, port=port)