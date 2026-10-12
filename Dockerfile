# The backend API. Built and run by Hugging Face Spaces (Docker SDK).
FROM python:3.12-slim

# uv installs the exact versions in uv.lock. Copying the binary from uv's own
# image avoids installing it with pip.
COPY --from=ghcr.io/astral-sh/uv:0.12.23 /uv /bin/uv

WORKDIR /app

# Dependencies first, in their own layer: they change rarely, so Docker reuses
# this layer and a code-only change rebuilds in seconds.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN uv sync --frozen --no-dev

# Hugging Face runs containers as user 1000, not root.
USER 1000

# 7860 is the port Hugging Face Spaces expects.
EXPOSE 7860
CMD ["/app/.venv/bin/uvicorn", "resume_agent.api.app:app", "--host", "0.0.0.0", "--port", "7860"]
