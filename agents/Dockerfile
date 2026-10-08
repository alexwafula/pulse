FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /pulse-app
RUN useradd --uid 10001 --create-home pulse
COPY agents ./agents
USER pulse
EXPOSE 8090
CMD ["python", "agents/run.py", "--host", "0.0.0.0", "--port", "8090"]
