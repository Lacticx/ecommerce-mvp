FROM node:20-alpine
WORKDIR /app
COPY proto ./proto
WORKDIR /app/services/product-service
COPY services/product-service/package*.json ./
RUN npm install --omit=dev
COPY services/product-service/src ./src
CMD ["node", "src/index.js"]
