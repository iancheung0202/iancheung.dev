FROM python:3.12-slim

COPY --from=ghcr.io/getzola/zola:v0.21.0 /bin/zola /usr/local/bin/zola

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN zola build

VOLUME ["/app/data"]
EXPOSE 8085
CMD ["python3", "main.py"]
