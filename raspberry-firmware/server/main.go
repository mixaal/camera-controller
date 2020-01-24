package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// #cgo CFLAGS: -I../
// #cgo LDFLAGS: -L../ -lcamctrl -lgphoto2 -lgphoto2_port
// #include <libcamctrl.h>
import "C"

var imageChannel chan []byte
var hasPreview bool = true

func streamPreview(w http.ResponseWriter, r *http.Request) {
	if hasPreview {
		content, err := ioutil.ReadFile("liveview.jpg")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/octetstream")
		w.WriteHeader(http.StatusOK)
		//w.Write(<-imageChannel)
		w.Write(content)
	} else {
		http.NotFound(w, r)
	}
}

func getIndex(w http.ResponseWriter, r *http.Request) {
	content, err := ioutil.ReadFile("index.html")
	if err == nil {
		//w.Header().Set("Content-Type", "application/text")
		//w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, string(content))
	} else {
		http.NotFound(w, r)
	}
}

func liveViewOff(w http.ResponseWriter, r *http.Request) {
	C.camera_eosviewfinder(0)
	w.WriteHeader(http.StatusCreated)
}

func liveViewOn(w http.ResponseWriter, r *http.Request) {
	C.camera_eosviewfinder(1)
	w.WriteHeader(http.StatusCreated)
}

func post(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(`{"message": "post called"}`))
}

func put(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(`{"message": "put called"}`))
}

func delete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "delete called"}`))
}

func notFound(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte(`{"message": "not found"}`))
}

func liveView(c chan []byte) {
	start := time.Now()
	for true {
		now := time.Now()
		if now.Sub(start) > 100 /*ms*/ {
			C.capture_image()
			content, err := ioutil.ReadFile("liveview.jpg")
			if err != nil {
				c <- content
			}
		}
	}
}

func main() {
	err := int(C.init_camera())
	if err != 0 {
		fmt.Println("Can't initialize camera, err=" + strconv.Itoa(err))
		os.Exit(1)
	}
	defer C.exit_camera()
	err = int(C.camera_eosviewfinder(1))
	if err != 0 {
		fmt.Println("Can't initialize liveview, err=" + strconv.Itoa(err))
		os.Exit(1)
	}
	defer C.camera_eosviewfinder(0)
	imageChannel = make(chan []byte, 1)
	go liveView(imageChannel)
	fmt.Println("Starting server on :8080...")
	r := mux.NewRouter()
	r.HandleFunc("/liveview.jpg", streamPreview).Methods(http.MethodGet)
	r.HandleFunc("/", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/liveViewOn", liveViewOn).Methods(http.MethodPost)
	r.HandleFunc("/liveViewOff", liveViewOff).Methods(http.MethodPost)
	//    r.HandleFunc("/", post).Methods(http.MethodPost)
	//    r.HandleFunc("/", put).Methods(http.MethodPut)
	//    r.HandleFunc("/", delete).Methods(http.MethodDelete)
	r.HandleFunc("/", notFound)
	log.Fatal(http.ListenAndServe(":8080", r))
}
