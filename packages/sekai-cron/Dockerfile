FROM ubuntu:24.04 

RUN apt update
RUN apt install -y ca-certificates

COPY ./dist/sekai-cron ./sekai-cron

CMD [ "./sekai-cron" ]
