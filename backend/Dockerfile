FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for fonts, image processing, and PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    fonts-thai-tlwg \
    fonts-noto-cjk \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create directory for PDF archives
RUN mkdir -p /app/storage/reports /app/storage/signatures

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
