FROM node:20-alpine
WORKDIR /app
COPY proto ./proto
WORKDIR /app/services/customer-service
COPY services/customer-service/package*.json ./
RUN npm install --omit=dev
COPY services/customer-service/src ./src
CMD ["node", "src/index.js"]
