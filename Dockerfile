FROM node:14 AS builder
WORKDIR /opt/app
RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev

COPY package.json package-lock.json ./
RUN npm install
COPY tsconfig.json ./
COPY server server
RUN npx tsc


FROM node:14-slim
ENV NODE_ENV=production
WORKDIR /opt/app
RUN apt-get update && apt-get install -y libcairo2 libpango1.0 libjpeg-dev libgif-dev librsvg2-dev
COPY --from=builder /opt/app/node_modules node_modules
COPY --from=builder /opt/app/built built
CMD ["node", "./built/Main.js"]
