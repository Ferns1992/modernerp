FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ git dos2unix

COPY package*.json package-lock.json ./
RUN npm install

COPY . .

RUN find . -name "*.ts" -exec dos2unix {} \; 2>/dev/null || true

RUN npx tsc server.ts --outDir . --skipLibCheck --module nodenext --moduleResolution nodenext --esModuleInterop --target es2020

EXPOSE 4000

CMD ["node", "server.js"]