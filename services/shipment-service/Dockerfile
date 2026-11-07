FROM node:20-alpine
WORKDIR /app
COPY proto ./proto
WORKDIR /app/services/shipment-service
COPY services/shipment-service/package*.json ./
RUN npm install --omit=dev
COPY services/shipment-service/src ./src
CMD ["node", "src/index.js"]
