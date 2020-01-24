CC=gcc
RM=rm -f
AR=ar
LIBS=-lgphoto2 -lgphoto2_port
CFLAGS=-Wall -O2 -shared

CAMCTRL=camctrl
LIBCAM=libcamctrl.a
OBJECTS=libcamctrl.o
SUFFIXES=.o .c .cc .cpp

all: $(CAMCTRL) $(LIBCAM)

$(LIBCAM): $(OBJECTS)
	$(AR) rcs $(LIBCAM) $(OBJECTS)

$(CAMCTRL): $(CAMCTRL).o
	$(CC) -o $(CAMCTRL) $(CAMCTRL).o $(LIBS)

clean:
	$(RM) *.o $(CAMCTRL) $(LIBCAM)
