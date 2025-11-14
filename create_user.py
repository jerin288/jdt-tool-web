"""
Create a new user account
"""
from app import app, db, User

# User details
NEW_EMAIL = "newuser@example.com"  # Change this
NEW_PASSWORD = "mypassword"         # Change this

with app.app_context():
    # Check if user exists
    existing = User.query.filter_by(email=NEW_EMAIL.lower()).first()
    
    if existing:
        print(f"❌ User {NEW_EMAIL} already exists!")
    else:
        # Create new user
        user = User(
            email=NEW_EMAIL.lower(),
            referral_code=User.generate_referral_code(),
            total_credits=3,
            used_credits=0
        )
        user.set_password(NEW_PASSWORD)
        
        db.session.add(user)
        db.session.commit()
        
        print(f"✅ User created successfully!")
        print(f"   Email: {user.email}")
        print(f"   Password: {NEW_PASSWORD}")
        print(f"   Referral Code: {user.referral_code}")
        print(f"   Credits: {user.get_available_credits()}")
