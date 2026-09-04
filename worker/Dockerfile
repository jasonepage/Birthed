# Birthed pipeline worker.
# Slice 1 needs Node only. Playwright and headless Chromium arrive in slice 5,
# when the terms pages that render client side have to be read.
FROM node:22-slim

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

# Node 22 strips TypeScript types at load, so there is no build step and no
# runtime dependency to install for slice 1.
ENV NODE_ENV=production

CMD ["node", "--experimental-strip-types", "src/import-all.ts"]
