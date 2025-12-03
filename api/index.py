# Vercel serverless function entry point
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set Vercel environment variable before importing app
os.environ['VERCEL'] = '1'

# Import Flask app - Vercel will handle it automatically
from app import app

# Vercel Python runtime automatically detects Flask apps
# Just export the app instance directly

