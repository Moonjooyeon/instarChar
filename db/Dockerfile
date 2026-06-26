FROM postgres:16-alpine
ENV POSTGRES_USER=instarchat
ENV POSTGRES_PASSWORD=instarchat
ENV POSTGRES_DB=instarchat
COPY init.sql /docker-entrypoint-initdb.d/init.sql
