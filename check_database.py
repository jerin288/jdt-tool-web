"""
Check database configuration
"""
import requests

RENDER_URL = "https://jdpdftoexcel.online"

print("="*60)
print("Database Configuration Check")
print("="*60)
print()

# Try to get some info from the server
try:
    response = requests.get(f"{RENDER_URL}/api/user-status", timeout=10)
    print(f"✅ Server is responding: {response.status_code}")
    print()
    
    # Try a simple test
    print("Testing if database is accessible...")
    test_response = requests.post(
        f"{RENDER_URL}/auth/login",
        json={"email": "nonexistent@test.com", "password": "test"},
        timeout=10
    )
    
    if test_response.status_code == 401:
        print("✅ Database is accessible (got expected 401 Unauthorized)")
        print()
        print("The database is working, but signup might have an issue.")
        print("Try signing up directly on the website:")
        print("  https://jdpdftoexcel.online/")
    elif test_response.status_code == 500:
        print("❌ Database error (500 Internal Server Error)")
        print()
        print("This usually means:")
        print("  1. DATABASE_URL is not set in Render environment variables")
        print("  2. PostgreSQL database is not created")
        print("  3. Connection string is incorrect")
        print()
        print("Please check Render Dashboard:")
        print("  1. Go to your web service settings")
        print("  2. Check 'Environment' tab")
        print("  3. Verify DATABASE_URL is set correctly")
    else:
        print(f"⚠️  Unexpected response: {test_response.status_code}")
        print(f"Response: {test_response.text[:200]}")
        
except Exception as e:
    print(f"❌ Error: {e}")
