FROM node:18.20.2
COPY . .
RUN npm install
EXPOSE 3000
CMD [ "node" ,"index.js" ]
