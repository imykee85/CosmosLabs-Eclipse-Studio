FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir numpy==2.1.3 pillow==11.0.0
WORKDIR /app
COPY scripts/ scripts/
COPY server.py .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "server.py"]
