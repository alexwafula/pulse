FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY app ./app
# Build identity for /version and X-Pulse-Build; empty values report "unknown".
ARG PULSE_BUILD_SHA=""
ARG PULSE_BUILD_TIME=""
ARG PULSE_BUILD_REF=""
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w \
      -X github.com/alexwafula/pulse/app/internal/buildinfo.SHA=${PULSE_BUILD_SHA} \
      -X github.com/alexwafula/pulse/app/internal/buildinfo.BuiltAt=${PULSE_BUILD_TIME} \
      -X github.com/alexwafula/pulse/app/internal/buildinfo.Ref=${PULSE_BUILD_REF}" \
    -o /pulse ./app/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /pulse-app
COPY --from=build /pulse /pulse
COPY app/web/templates ./app/web/templates
COPY app/web/static ./app/web/static
COPY data ./data
EXPOSE 8080
ENTRYPOINT ["/pulse"]
CMD ["-addr", "0.0.0.0:8080"]
