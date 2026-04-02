FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ git dos2unix

COPY package*.json package-lock.json ./
RUN npm install --ignore-scripts

COPY . .

RUN find . -name "*.ts" -exec dos2unix {} \;

RUN npm run build || echo "Frontend build done"

EXPOSE 4000

CMD ["npx", "tsx", "server.ts"]