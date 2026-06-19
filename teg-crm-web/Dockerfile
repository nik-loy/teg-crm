FROM node:20-alpine

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
