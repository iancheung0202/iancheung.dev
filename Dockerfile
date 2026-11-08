FROM python:3.12-slim

ARG ZOLA_VERSION=0.21.0
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && case "$TARGETARCH" in arm64) arch=aarch64 ;; *) arch=x86_64 ;; esac \
 && curl -sSL "https://github.com/getzola/zola/releases/download/v${ZOLA_VERSION}/zola-v${ZOLA_VERSION}-${arch}-unknown-linux-gnu.tar.gz" \
    | tar -xz -C /usr/local/bin zola \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN zola build

VOLUME ["/app/data"]
EXPOSE 8085
CMD ["python3", "main.py"]
