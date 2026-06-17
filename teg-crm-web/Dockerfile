FROM node:20-alpine

WORKDIR /app

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy package configuration files
COPY package.json package-lock.json ./
RUN npm ci

# Copy all frontend files
COPY . .

# Build-time placeholders
ENV GEMINI_API_KEY=placeholder
ENV AUTH_SECRET=placeholder_min_32_chars_xxxxxxxxxx
ENV APP_PASSWORD=placeholder

# Build application
RUN npm run build

# Set up files for standalone execution
RUN cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
