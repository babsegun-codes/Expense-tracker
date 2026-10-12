# Production image
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install -g npm@12.2.0 \
    && npm install --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY src ./src

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 4500

CMD ["node", "src/server.js"]