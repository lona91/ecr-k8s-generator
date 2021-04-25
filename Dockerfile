FROM node:12-alpine

WORKDIR /opt/app

ENV AWS_DEFAULT_REGION=eu-east-1
ENV SECRET_NAME=ecr-pull-secret

COPY ./src/index.js ./index.js
COPY package.json package.json

RUN npm install

RUN chmod a+x ./index.js

CMD ["node", "index.js"]
