FROM node:20-alpine
WORKDIR /app
COPY proto ./proto
WORKDIR /app/services/order-service
COPY services/order-service/package*.json ./
RUN npm install --omit=dev
COPY services/order-service/src ./src
CMD ["node", "src/index.js"]
