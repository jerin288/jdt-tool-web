"""
Test login functionality and check user passwords
"""
from app import app, db, User
from werkzeug.security import check_password_hash

with app.app_context():
    # Get all users
    users = User.query.all()
    
    print(f"\n=== Found {len(users)} users ===\n")
    
    for user in users:
        print(f"Email: {user.email}")
        print(f"Password hash: {user.password[:50]}..." if user.password else "No password!")
        print(f"Referral code: {user.referral_code}")
        
        # Test default password
        if user.password:
            test_password = "password123"
            matches = check_password_hash(user.password, test_password)
            print(f"Default password 'password123' works: {matches}")
        
        print("-" * 50)
