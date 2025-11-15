"""Check user credits on remote deployment"""
import os
import sys
import requests

# Configuration
RENDER_URL = os.environ.get('RENDER_URL', "https://jdpdftoexcel.online/")
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

if not ADMIN_KEY:
    print("⚠️  Warning: ADMIN_KEY environment variable not set!")
    print("Set it with: $env:ADMIN_KEY='your_key_here' (PowerShell)")
    sys.exit(1)

def check_credits(email):
    """Check credits for a specific user"""
    url = f"{RENDER_URL}/admin/check_credits"
    payload = {
        "admin_key": ADMIN_KEY,
        "email": email
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Credits for {data['email']}:")
            print(f"   Total Credits: {data['total_credits']}")
            print(f"   Used Credits: {data['used_credits']}")
            print(f"   Available: {data['available_credits']}")
            print(f"   Created: {data['created_at']}")
            return data
        else:
            print(f"❌ Error: {response.json().get('error', 'Unknown error')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        return None

if __name__ == "__main__":
    print("=" * 60)
    print("Check User Credits")
    print("=" * 60)
    
    email = input("\nEnter user email to check: ").strip()
    
    if not email:
        print("❌ Email is required!")
        sys.exit(1)
    
    # Check credits
    result = check_credits(email)
    
    if result:
        # Ask if want to add more credits
        add_more = input("\nAdd more credits? (y/n): ").strip().lower()
        
        if add_more == 'y':
            try:
                credits = int(input("Enter credits to add: ").strip())
                if credits <= 0:
                    print("❌ Credits must be positive!")
                    sys.exit(1)
                
                # Add credits
                url = f"{RENDER_URL}/admin/add_credits"
                payload = {
                    "admin_key": ADMIN_KEY,
                    "email": email,
                    "credits": credits
                }
                
                response = requests.post(url, json=payload, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    print(f"\n✅ Success: {data['message']}")
                    print(f"   New Total: {data['user']['new_total']}")
                    print(f"   Available: {data['user']['available']}")
                else:
                    print(f"❌ Error: {response.json().get('error', 'Unknown error')}")
            except ValueError:
                print("❌ Invalid number!")
            except Exception as e:
                print(f"❌ Error: {e}")
