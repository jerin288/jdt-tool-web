"""Migration script to add credit_transactions table and populate initial history"""
import sqlite3
import os
from datetime import datetime

db_path = os.path.join('instance', 'jdt_users.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Starting credit history migration...")

# Create credit_transactions table
cursor.execute('''
CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    timestamp DATETIME NOT NULL,
    balance_after INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
''')

print("✅ credit_transactions table created")

# Create initial signup transactions for existing users
cursor.execute("SELECT id, email, total_credits, created_at FROM users")
users = cursor.fetchall()

for user_id, email, total_credits, created_at in users:
    # Check if user already has transactions
    cursor.execute("SELECT COUNT(*) FROM credit_transactions WHERE user_id = ?", (user_id,))
    count = cursor.fetchone()[0]
    
    if count == 0:
        # Add initial signup bonus transaction
        cursor.execute('''
            INSERT INTO credit_transactions (user_id, amount, transaction_type, description, timestamp, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, 20, 'signup', 'Welcome bonus - 20 credits', created_at, 20))
        
        print(f"  Added signup transaction for {email}")

conn.commit()
print("\n✅ Migration completed successfully!")
print(f"Total users: {len(users)}")

# Show summary
cursor.execute("SELECT COUNT(*) FROM credit_transactions")
total_transactions = cursor.fetchone()[0]
print(f"Total transactions: {total_transactions}")

conn.close()
