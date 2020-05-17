ARG BASE="amd64"

FROM $BASE/node:12.16.2 AS builder
ENV NODE_ENV=production
WORKDIR /opt/app
RUN apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev

# Hack to get around QEMU's stderr logging that causes npm install to fail
# QEMU logs e.g. "qemu: Unsupported syscall: 397" during the npm run and due to that e.g. node-gyp
# fails. Replace real node binary with a shell script redirecting stderr to /dev/null while running npm install
RUN mv /usr/local/bin/node /usr/local/bin/node_real && \
  echo "#!/bin/bash\n/usr/local/bin/node_real \$@ 2>/dev/null" > /usr/local/bin/node && \
  chmod a+x /usr/local/bin/node
COPY package.json package-lock.json ./
RUN npm install
# Restore original node binary
RUN mv /usr/local/bin/node_real /usr/local/bin/node
COPY tsconfig.json ./
COPY server server
RUN npx tsc


FROM $BASE/node:12.16.2-slim
ENV NODE_ENV=production
WORKDIR /opt/app
RUN apt-get update && apt-get install -y libcairo2 libpango1.0 libjpeg-dev libgif-dev librsvg2-dev
COPY --from=builder /opt/app/node_modules node_modules
COPY --from=builder /opt/app/built built
CMD ["node", "./built/Main.js"]
