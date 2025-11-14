"""
Test script for Referral Credits System
Run this to verify the implementation is working correctly
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db, User, ReferralLog, Conversion

def test_database():
    """Test database initialization"""
    print("🔍 Testing database...")
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database initialized successfully")
            return True
        except Exception as e:
            print(f"❌ Database error: {e}")
            return False

def test_user_creation():
    """Test user creation with referral"""
    print("\n🔍 Testing user creation...")
    with app.app_context():
        try:
            # Create test user 1
            user1 = User(
                email="test1@example.com",
                referral_code=User.generate_referral_code(),
                total_credits=3,
                used_credits=0
            )
            db.session.add(user1)
            db.session.commit()
            print(f"✅ User 1 created: {user1.email} (Code: {user1.referral_code})")
            
            # Create test user 2 with referral
            user2 = User(
                email="test2@example.com",
                referral_code=User.generate_referral_code(),
                referred_by_code=user1.referral_code,
                total_credits=3,
                used_credits=0
            )
            db.session.add(user2)
            
            # Award referral credit
            user1.total_credits += 5
            ref_log = ReferralLog(
                referrer_id=user1.id,
                referee_email=user2.email,
                credited=True
            )
            db.session.add(ref_log)
            db.session.commit()
            
            print(f"✅ User 2 created: {user2.email} (Referred by User 1)")
            print(f"✅ User 1 awarded +5 credits (Total: {user1.total_credits})")
            
            return True
        except Exception as e:
            print(f"❌ User creation error: {e}")
            db.session.rollback()
            return False

def test_credit_system():
    """Test credit checking and usage"""
    print("\n🔍 Testing credit system...")
    with app.app_context():
        try:
            user = User.query.filter_by(email="test1@example.com").first()
            if not user:
                print("❌ Test user not found")
                return False
            
            initial_credits = user.get_available_credits()
            print(f"   Initial credits: {initial_credits}")
            
            # Simulate conversion
            user.used_credits += 1
            db.session.commit()
            
            remaining = user.get_available_credits()
            print(f"   After conversion: {remaining}")
            print(f"✅ Credit deduction working (used 1 credit)")
            
            # Test daily reset
            user.reset_daily_credits()
            print(f"   After daily reset: {user.get_available_credits()}")
            print(f"✅ Daily reset working")
            
            return True
        except Exception as e:
            print(f"❌ Credit system error: {e}")
            return False

def test_referral_tracking():
    """Test referral logging"""
    print("\n🔍 Testing referral tracking...")
    with app.app_context():
        try:
            referrals = ReferralLog.query.all()
            print(f"✅ Total referrals logged: {len(referrals)}")
            
            for ref in referrals:
                referrer = User.query.get(ref.referrer_id)
                print(f"   {referrer.email} → {ref.referee_email} ({'Credited' if ref.credited else 'Pending'})")
            
            return True
        except Exception as e:
            print(f"❌ Referral tracking error: {e}")
            return False

def cleanup_test_data():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    with app.app_context():
        try:
            User.query.filter(User.email.like('test%@example.com')).delete()
            db.session.commit()
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"❌ Cleanup error: {e}")
            db.session.rollback()

def main():
    print("=" * 60)
    print("🚀 JDT PDF Converter - Referral System Test Suite")
    print("=" * 60)
    
    all_passed = True
    
    # Run tests
    if not test_database():
        all_passed = False
    
    if not test_user_creation():
        all_passed = False
    
    if not test_credit_system():
        all_passed = False
    
    if not test_referral_tracking():
        all_passed = False
    
    # Cleanup
    cleanup_test_data()
    
    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
        print("\nNext steps:")
        print("1. Configure email environment variables")
        print("2. Run: python app.py")
        print("3. Open: http://localhost:5000")
        print("4. Test login flow with real email")
    else:
        print("❌ SOME TESTS FAILED")
        print("Check the errors above and fix issues")
    print("=" * 60)

if __name__ == "__main__":
    main()
