# ============================================================================
# Build Flow BPO — imagem Docker (Render Docker / Hugging Face Spaces / VPS)
# Uso local:  docker build -t build-flow . && docker run -p 8000:8000 --env-file .env build-flow
# ============================================================================
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend
COPY database ./database

WORKDIR /app/backend

EXPOSE 8000

# ${PORT:-8000}: Render define $PORT; Hugging Face Spaces define $PORT=7860
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
