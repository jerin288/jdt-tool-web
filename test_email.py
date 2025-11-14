"""
Quick email configuration test
"""
import os
from flask import Flask
from flask_mail import Mail, Message

app = Flask(__name__)

# Email configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'Jerinad123@gmail.com'
app.config['MAIL_PASSWORD'] = 'vnfphjoonwbywyot'  # No spaces
app.config['MAIL_DEFAULT_SENDER'] = 'Jerinad123@gmail.com'

mail = Mail(app)

def test_email():
    """Test sending a simple email"""
    print("Testing email configuration...")
    print(f"MAIL_SERVER: {app.config['MAIL_SERVER']}")
    print(f"MAIL_PORT: {app.config['MAIL_PORT']}")
    print(f"MAIL_USERNAME: {app.config['MAIL_USERNAME']}")
    print(f"MAIL_PASSWORD: {'*' * len(app.config['MAIL_PASSWORD'])}")
    print()
    
    try:
        with app.app_context():
            msg = Message(
                'Test Email from JDT PDF Converter',
                recipients=['Jerinad123@gmail.com']
            )
            msg.body = 'This is a test email. If you receive this, email configuration is working!'
            msg.html = '<p>This is a test email. If you receive this, <strong>email configuration is working!</strong></p>'
            
            print("Sending test email...")
            mail.send(msg)
            print("✅ Email sent successfully!")
            print("Check your inbox: Jerinad123@gmail.com")
            return True
            
    except Exception as e:
        print(f"❌ Email sending failed!")
        print(f"Error: {str(e)}")
        print()
        print("Common issues:")
        print("1. App password incorrect (check for spaces)")
        print("2. 2-Factor Authentication not enabled on Gmail")
        print("3. App password not generated yet")
        print("4. 'Less secure app access' disabled")
        print()
        print("Solutions:")
        print("1. Go to: https://myaccount.google.com/apppasswords")
        print("2. Create new App Password for 'Mail'")
        print("3. Copy the 16-character password (remove spaces)")
        print("4. Update the password in the script")
        return False

if __name__ == "__main__":
    test_email()
