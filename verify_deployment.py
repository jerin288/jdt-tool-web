"""Quick verification that deployment is working"""
import os
import requests

RENDER_URL = os.environ.get('RENDER_URL', "https://jdpdftoexcel.online/")
ADMIN_KEY = os.environ.get('ADMIN_KEY', '')

print("="*60)
print("DEPLOYMENT VERIFICATION")
print("="*60)

# Test 1: Check server is up
print("\n1. Testing server status...")
try:
    response = requests.get(f"{RENDER_URL}/admin/test", timeout=5)
    if response.status_code == 200:
        print("   ✅ Server is UP and responding")
    else:
        print(f"   ❌ Server returned status: {response.status_code}")
except Exception as e:
    print(f"   ❌ Server error: {e}")
    exit(1)

# Test 2: Check credits for jerinad123@gmail.com
print("\n2. Checking credits...")
try:
    response = requests.post(
        f"{RENDER_URL}/admin/add_credits",
        json={
            "admin_key": ADMIN_KEY,
            "email": "jerinad123@gmail.com",
            "credits": 0  # Add 0 to just check current
        },
        timeout=10
    )
    
    if response.status_code == 400:
        # Expected - we sent 0 credits
        print("   ✅ Admin endpoint is working")
        
        # Now check actual credits with a small addition
        response = requests.post(
            f"{RENDER_URL}/admin/add_credits",
            json={
                "admin_key": ADMIN_KEY,
                "email": "jerinad123@gmail.com",
                "credits": 2  # Add just 2 to verify
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n   📊 CURRENT CREDITS:")
            print(f"      Email: {data['user']['email']}")
            print(f"      Total: {data['user']['new_total']}")
            print(f"      Available: {data['user']['available']}")
            print(f"\n   ✅ Credits are WORKING!")
        else:
            print(f"   ❌ Error: {response.text}")
    else:
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "="*60)
print("VERIFICATION COMPLETE")
print("="*60)
print("\n💡 Go to: https://jdpdftoexcel.online/")
print("💡 Login and check if you can logout and see correct credits")
