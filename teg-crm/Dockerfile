FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/app/data

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy all source files first so pip install . can find the package directories
COPY . .

# Install python package and dependencies including dev (for tests)
RUN pip install --no-cache-dir ".[dev]"

# Expose port
EXPOSE 8000

# Run django server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
