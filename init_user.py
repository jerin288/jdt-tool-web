"""
Initialize user account on remote PostgreSQL database
"""
import requests
import json

RENDER_URL = "https://jdpdftoexcel.online"

def signup_user(email, password):
    """Sign up a new user"""
    url = f"{RENDER_URL}/auth/signup"
    
    data = {
        'email': email,
        'password': password
    }
    
    print(f"Creating account for: {email}")
    try:
        response = requests.post(url, json=data, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ Account created successfully!")
            print(f"   Email: {email}")
            print(f"   Initial Credits: 20 (signup bonus)")
            return True
        elif response.status_code == 409:
            print(f"⚠️  Account already exists for {email}")
            print(f"   You can login at https://jdpdftoexcel.online/")
            return True
        else:
            try:
                error = response.json()
                print(f"❌ Error: {error.get('error', 'Unknown error')}")
            except:
                print(f"❌ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("Initialize User on PostgreSQL Database")
    print("="*60)
    print()
    
    email = input("Enter email: ").strip()
    password = input("Enter password: ").strip()
    
    if signup_user(email, password):
        print()
        print("✅ SUCCESS! Now you can:")
        print("   1. Login at https://jdpdftoexcel.online/")
        print("   2. Run add_credits_remote.py to add more credits")
        print("   3. Your data will PERSIST across deployments!")
    else:
        print()
        print("❌ Failed to create account")
