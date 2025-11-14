"""
Deploy to Render using Deploy Hook
Usage: python deploy_to_render.py
"""

import requests
import sys

DEPLOY_HOOK_URL = "https://api.render.com/deploy/srv-d4bc8bruibrs739pn27g?key=CZDYwCvhzGY"

def trigger_deploy():
    print("🚀 Triggering deployment to Render...")
    
    try:
        response = requests.post(DEPLOY_HOOK_URL)
        
        if response.status_code == 200:
            print("✅ Deployment triggered successfully!")
            print("🌐 Check status at: https://dashboard.render.com/")
            print("🔗 Site: https://jdpdftoexcel.online/")
            return 0
        else:
            print(f"❌ Deployment failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            return 1
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(trigger_deploy())
