# Birthed pipeline worker.
# Slice 1 needs Node only. Playwright and headless Chromium arrive in slice 5,
# when the terms pages that render client side have to be read.
FROM node:22-slim

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
COPY test ./test
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/src/import-all.js"]
