FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ nodejs-dev
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache nodejs-dev
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/cli ./cli
EXPOSE 9098
CMD ["node", "dist/index.js"]
