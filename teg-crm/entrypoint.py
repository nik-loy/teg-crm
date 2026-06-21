import os
import sys
import subprocess

def run_cmd(args):
    print(f"Running: {' '.join(args)}")
    subprocess.run(args, check=True)

def main():
    # 1. Run migrations
    run_cmd([sys.executable, "manage.py", "migrate", "--noinput"])

    # 2. Setup superuser if not exists
    create_superuser_code = """
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print("Superuser 'admin' created successfully.")
else:
    print("Superuser 'admin' already exists.")
"""
    run_cmd([sys.executable, "manage.py", "shell", "-c", create_superuser_code.strip()])

    # 3. Seed database
    run_cmd([sys.executable, "seed.py"])

    # 4. Start Django server
    args = [sys.executable, "manage.py", "runserver", "0.0.0.0:8000"]
    os.execvp(args[0], args)

if __name__ == "__main__":
    main()
