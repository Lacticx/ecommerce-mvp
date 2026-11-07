FROM node:20-alpine
WORKDIR /app
COPY proto ./proto
WORKDIR /app/services/auth-service
COPY services/auth-service/package*.json ./
RUN npm install --omit=dev
COPY services/auth-service/src ./src
CMD ["node", "src/index.js"]
