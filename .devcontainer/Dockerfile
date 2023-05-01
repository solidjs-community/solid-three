# For more information, please refer to https://aka.ms/vscode-docker-python
FROM mcr.microsoft.com/devcontainers/typescript-node:0-20

WORKDIR /app
COPY . /app

# Install pip requirements
RUN  apt-get update

# Creates a non-root user with an explicit UID and adds permission to access the /app folder
# For more info, please refer to https://aka.ms/vscode-docker-python-configure-containers
RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser