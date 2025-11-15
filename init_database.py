"""
Initialize PostgreSQL database tables on Render
"""
import requests

RENDER_URL = "https://jdpdftoexcel.online"

def init_database():
    """Initialize the database by triggering table creation"""
    print("="*60)
    print("Initializing PostgreSQL Database")
    print("="*60)
    print()
    
    # Just hit the homepage - this will trigger table creation
    print("Triggering database table creation...")
    try:
        response = requests.get(f"{RENDER_URL}/", timeout=30)
        print(f"✅ Server responded with status: {response.status_code}")
        
        # Try to signup with a test user to ensure tables are created
        print("\nCreating initial database schema...")
        test_response = requests.post(
            f"{RENDER_URL}/auth/signup",
            json={"email": "test_init@example.com", "password": "test12345"},
            timeout=30
        )
        
        if test_response.status_code in [201, 409]:  # 201 = created, 409 = already exists
            print("✅ Database tables created successfully!")
            print()
            print("You can now:")
            print("  1. Sign up at https://jdpdftoexcel.online/")
            print("  2. Use your credentials to login")
            print("  3. Your credits will persist permanently!")
            return True
        else:
            print(f"⚠️  Unexpected response: {test_response.status_code}")
            print(f"Response: {test_response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
        print("This might mean:")
        print("  1. Database is still initializing (wait 1-2 minutes)")
        print("  2. DATABASE_URL environment variable needs to be set in Render")
        print("  3. PostgreSQL database needs to be created in Render dashboard")
        return False

if __name__ == "__main__":
    init_database()
