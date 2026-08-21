FROM python:3.11-slim

# Node for zerodytrash tiktok-live-connector (sync per-request fetch, no background hold)
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY package.json ./
RUN npm install --omit=dev

COPY app ./app
COPY tests ./tests
COPY scripts ./scripts

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
