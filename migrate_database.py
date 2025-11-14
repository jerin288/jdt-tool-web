"""
Database migration script to add password field to existing users
"""
import os
import sys
from app import app, db, User
from werkzeug.security import generate_password_hash

def migrate_database():
    """Add password field to existing User table"""
    with app.app_context():
        # Check if we need to add the password column
        try:
            # Try to query a user's password
            user = User.query.first()
            if user:
                _ = user.password  # This will fail if column doesn't exist
                print("✓ Password column already exists!")
                return
        except:
            print("Adding password column to users table...")
            
            # Add the password column with ALTER TABLE
            from sqlalchemy import text
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN password VARCHAR(255)"))
                conn.commit()
            
            print("✓ Password column added successfully!")
            
            # Set default password for existing users
            users = User.query.all()
            default_password = "password123"
            
            for user in users:
                if not user.password:
                    user.password = generate_password_hash(default_password)
            
            db.session.commit()
            print(f"✓ Set default password for {len(users)} existing users")
            print(f"  Default password: {default_password}")
            print("  ⚠️  Users should change their password after first login!")

if __name__ == '__main__':
    print("Starting database migration...")
    try:
        migrate_database()
        print("\n✓ Migration completed successfully!")
    except Exception as e:
        print(f"\n✗ Migration failed: {str(e)}")
        sys.exit(1)
