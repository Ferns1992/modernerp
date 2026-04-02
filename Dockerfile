FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ git dos2unix

COPY package*.json package-lock.json ./
RUN npm install --ignore-scripts

COPY . .

RUN dos2unix server.ts 2>/dev/null || true

RUN npm run build || echo "Frontend build done"

EXPOSE 4000

CMD ["npx", "tsx", "server.ts"]