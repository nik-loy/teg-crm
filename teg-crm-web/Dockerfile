FROM node:20-alpine

# Install Chromium and its dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Copy package configuration files
COPY package.json package-lock.json ./
RUN npm ci

# Copy all frontend files
COPY . .

# Build application
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview"]
