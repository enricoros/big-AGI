FROM node:alpine3.16

# create & set working directory
RUN mkdir -p /usr/src
WORKDIR /usr/src

# copy source files

# install dependencies

COPY package*.json ./
RUN npm install
RUN npm ci --omit=dev

COPY . /usr/src
# start app
RUN npm run build
EXPOSE 3000
CMD npm run start

