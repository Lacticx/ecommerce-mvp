FROM node:20-alpine
WORKDIR /app
COPY proto ./proto
WORKDIR /app/api-gateway
COPY api-gateway/package*.json ./
RUN npm install --omit=dev
COPY api-gateway/src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
