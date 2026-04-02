FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ git dos2unix

COPY package*.json package-lock.json ./
RUN npm install --ignore-scripts

COPY . .

RUN find . -name "*.ts" -exec dos2unix {} \; 2>/dev/null || true

RUN npm run build || true

EXPOSE 4000

CMD ["node", "server.js"]