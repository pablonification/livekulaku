# ---- build stage: vite + React 19 + Astryx ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# ---- serve stage: nginx ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# keep demo file also at fallback location for direct fetch via /demo_comments.jsonl (already in dist via public/)
EXPOSE 80
