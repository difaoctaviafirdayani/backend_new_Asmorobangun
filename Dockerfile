FROM node:20-alpine
WORKDIR /app

# install SEMUA dependency (ts-node & typescript dibutuhkan oleh "npm start")
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY api ./api
COPY scripts ./scripts
COPY public ./public

ENV NODE_ENV=production
RUN mkdir -p uploads data && chown -R node:node /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["npm", "start"]