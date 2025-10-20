FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments
ARG VITE_API_URL=http://localhost:3001
ARG VITE_ANALYZER_URL=http://localhost:8000
ARG VITE_ML_ANALYZER_URL=http://localhost:8001

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ANALYZER_URL=$VITE_ANALYZER_URL
ENV VITE_ML_ANALYZER_URL=$VITE_ML_ANALYZER_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
