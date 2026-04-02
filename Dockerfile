FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ git

COPY package*.json package-lock.json ./
RUN npm install

COPY . .

RUN mkdir -p dist && cp index.html dist/

EXPOSE 4000

CMD ["node", "server.js"]
