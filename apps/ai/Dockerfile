FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY apps/ai/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip && python -m pip install --prefer-binary --no-cache-dir -r requirements.txt
RUN useradd --create-home --uid 10001 app
COPY apps/ai/app ./app
COPY apps/ai/tests ./tests
USER app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
