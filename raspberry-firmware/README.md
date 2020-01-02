# Raspberry PI Zero Firmware Setup

## Install Raspbian Lite and Enable SSH

https://randomnerdtutorials.com/installing-raspbian-lite-enabling-and-connecting-with-ssh/

## Setup Wi-Fi Connection

```
cat /etc/wpa_supplicant/wpa_supplicant.conf
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
network={
  ssid="Your-Wifi-Network-SSID"
  psk="Your-Wifi-Network-Password"
}
```

## Install packages

```
sudo su -
apt install gphoto2 libgphoto2-dev libusb-dev dcraw hugin-tools enfuse
```

## Test 

On raspberry:
```
sudo su -
reboot
```

Your desktop:
```
$ ssh pi@<your-raspberry-ip-address>
pi@raspberrypi:~ $ lsusb
Bus 001 Device 004: ID 04a9:3199 Canon, Inc. EOS 5D Mark II
Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
```

Now you can use `gphoto2` to manipulate your camera:
```
gphoto2 --auto-detect
Model                          Port
----------------------------------------------------------
Canon EOS 5D Mark II           usb:001,005
```

