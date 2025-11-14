"""Update existing users to new credit system"""
import sqlite3
import os

# Connect to database in instance folder
db_path = os.path.join('instance', 'jdt_users.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all users
cursor.execute("SELECT id, email, total_credits, used_credits FROM users")
users = cursor.fetchall()

print("Current users:")
for user in users:
    print(f"  {user[1]}: {user[2]} total credits, {user[3]} used")

# Update all users to have at least 20 total credits
print("\nUpdating users to new credit system (20 initial credits)...")
for user in users:
    user_id, email, total_credits, used_credits = user
    # Give them 20 credits if they have less
    if total_credits < 20:
        new_total = 20
        cursor.execute("UPDATE users SET total_credits = ? WHERE id = ?", (new_total, user_id))
        print(f"  Updated {email}: {total_credits} -> {new_total} credits")
    else:
        print(f"  {email} already has {total_credits} credits (no change)")

conn.commit()

print("\nUpdated users:")
cursor.execute("SELECT id, email, total_credits, used_credits FROM users")
users = cursor.fetchall()
for user in users:
    available = user[2] - user[3]
    print(f"  {user[1]}: {user[2]} total, {user[3]} used, {available} available")

conn.close()
print("\nDone!")
