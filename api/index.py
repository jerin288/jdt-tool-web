# Vercel serverless function entry point
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set Vercel environment variable before importing app
os.environ['VERCEL'] = '1'

# Import Flask app
from app import app

# Vercel Python runtime automatically handles Flask apps
# Export the app as 'handler' or 'application'
handler = app
application = app

