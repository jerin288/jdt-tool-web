"""Add credits to users on remote deployment (Render/Railway)"""
import requests
import sys

# Configuration
RENDER_URL = "https://jdpdftoexcel.online/"  # Replace with your Render URL
ADMIN_KEY = "ZpWm8My21q7vJbNs8yT4NSCaifigunTJyGUNOuflch0"  # Replace with your admin key

def add_credits_to_user(email, credits):
    """Add credits to a specific user"""
    url = f"{RENDER_URL}/admin/add_credits"
    payload = {
        "admin_key": ADMIN_KEY,
        "email": email,
        "credits": credits
    }
    
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success: {data['message']}")
        if 'user' in data:
            user = data['user']
            print(f"   {user['email']}: {user['old_total']} → {user['new_total']} total credits")
            print(f"   Available: {user['available']} credits")
    else:
        print(f"❌ Error: {response.json().get('error', 'Unknown error')}")
        sys.exit(1)

def add_credits_to_all(credits):
    """Add credits to all users"""
    url = f"{RENDER_URL}/admin/add_credits"
    payload = {
        "admin_key": ADMIN_KEY,
        "add_to_all": True,
        "credits": credits
    }
    
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success: {data['message']}")
        print("\nUpdated users:")
        for user in data['updated_users']:
            print(f"  {user['email']}: {user['old_total']} → {user['new_total']} (available: {user['available']})")
    else:
        print(f"❌ Error: {response.json().get('error', 'Unknown error')}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("Add Credits to Remote Deployment")
    print("=" * 60)
    print("\n⚠️  Make sure to update RENDER_URL and ADMIN_KEY in this script!")
    print()
    
    # Get user input
    print("Options:")
    print("1. Add credits to specific user")
    print("2. Add credits to all users")
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        email = input("Enter user email: ").strip()
        credits = int(input("Enter credits to add: ").strip())
        add_credits_to_user(email, credits)
    elif choice == "2":
        credits = int(input("Enter credits to add to all users: ").strip())
        add_credits_to_all(credits)
    else:
        print("Invalid choice!")
        sys.exit(1)
