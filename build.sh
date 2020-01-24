#!/bin/bash -xe

cd raspberry-firmware

# Make static library first
make

# Build rest server
cd server
go build .

cat <<USAGE
Run ./rpi-server on your target host, e.g. raspberry-pi and point your browser to http://<IP>:8080/
USAGE
