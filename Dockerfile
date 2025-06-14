# Generated by https://smithery.ai. See: https://smithery.ai/docs/build/project-config
FROM node:lts-alpine

WORKDIR /app

# install dependencies without running prepare scripts
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

# copy source and build
COPY . .
RUN npm run build

# set default command to run the MCP server
ENTRYPOINT ["node", "dist/index.cjs"]
