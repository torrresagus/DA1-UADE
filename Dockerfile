FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# Al arrancar: crea el directorio de media en el volumen, aplica migraciones y levanta el servidor.
CMD ["sh", "-c", "mkdir -p /data/media && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
