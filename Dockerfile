FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY app ./app
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /pulse ./app/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /pulse-app
COPY --from=build /pulse /pulse
COPY app/web/templates ./app/web/templates
COPY app/web/static ./app/web/static
COPY data/samples ./data/samples
EXPOSE 8080
ENTRYPOINT ["/pulse"]
CMD ["-addr", "0.0.0.0:8080"]
