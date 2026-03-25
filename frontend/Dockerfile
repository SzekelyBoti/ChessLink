FROM node:18-alpine AS builder
 
WORKDIR /app
 
ARG VITE_API_URL=/api
ARG VITE_WS_URL=ws://localhost/ws
 
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
 
COPY package*.json ./
 
RUN npm ci
 
COPY . .
 
RUN npm run build
 
# ---------------------------------------------------------------------------
 
FROM nginx:alpine
 
COPY --from=builder /app/dist /usr/share/nginx/html

RUN apk add --no-cache sed

COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV API_URL=/api
ENV WS_URL=ws://localhost/ws

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
 
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]