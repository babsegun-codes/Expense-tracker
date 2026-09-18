# Production image
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY src ./src

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 4500

CMD ["node", "src/server.js"]