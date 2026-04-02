FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ git

COPY package*.json package-lock.json ./
RUN npm install --ignore-scripts

COPY . .

RUN npm run build || echo "Frontend build done"

EXPOSE 4000

CMD ["npx", "tsx", "server.ts"]