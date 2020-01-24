package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"bitbucket.org/JeremySchlatter/go-atexit"
	"github.com/gorilla/mux"
)

// #cgo CFLAGS: -I../
// #cgo LDFLAGS: -L../ -lcamctrl -lgphoto2 -lgphoto2_port
// #include <libcamctrl.h>
import "C"

var imageChannel chan []byte
var hasPreview bool = true

func streamPreview(w http.ResponseWriter, r *http.Request) {
	C.capture_image()
	content, err := ioutil.ReadFile("liveview.jpg")
	if err == nil {
		w.Header().Set("Content-Type", "application/octetstream")
		w.WriteHeader(http.StatusOK)
		w.Write(content)
	} else {
		http.NotFound(w, r)
	}
}

func serveFile(w http.ResponseWriter, r *http.Request, name string, binary bool) {
	content, err := ioutil.ReadFile(name)
	
	if err == nil {
		if binary {
		    w.Header().Set("Content-Type", "application/octetstream")
		    w.WriteHeader(http.StatusOK)
		    w.Write(content)
	        } else {
		    fmt.Fprint(w, string(content))
		}
	} else {
	        fmt.Println(name+":"+err.Error())
		http.NotFound(w, r)
	}
}

func getIndex(w http.ResponseWriter, r *http.Request) {
	fmt.Println("IDX")
	serveFile(w, r, "index.html", false)
}

func getMainJs(w http.ResponseWriter, r *http.Request) {
	fmt.Println("MAIN>JS")
	serveFile(w, r, "main.js", false)
}

func getFavicon(w http.ResponseWriter, r *http.Request) {
	fmt.Println("FAVICO")
	serveFile(w, r, "favicon.ico", true)
}


func turnLiveView(onOff int) {
	for retry := 0; retry < 10; retry++ {
		err := int(C.camera_eosviewfinder(C.int(onOff)))
		if err == 0 {
			return
		}
	}
}

func liveViewOff(w http.ResponseWriter, r *http.Request) {
	turnLiveView(0)
	w.WriteHeader(http.StatusCreated)
}

func liveViewOn(w http.ResponseWriter, r *http.Request) {
	turnLiveView(1)
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

func waitForCamera() {
	for true {
		err := int(C.init_camera())
		if err == 0 {
			return
		}
		time.Sleep(2 * time.Second)
	}
}

func main() {

	waitForCamera()
	err := int(C.camera_eosviewfinder(1))
	if err != 0 {
		fmt.Println("Can't initialize liveview, err=" + strconv.Itoa(err))
		os.Exit(1)
	}

	atexit.TrapSignals()
	defer atexit.CallExitFuncs()

	atexit.Run(func() {
		fmt.Println("Terminating camera...")
		turnLiveView(0)
		C.exit_camera()
	})

	fmt.Println("Starting server on :8080...")
	r := mux.NewRouter()
	r.HandleFunc("/liveview.jpg", streamPreview).Methods(http.MethodGet)
	r.HandleFunc("/", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/main.js", getMainJs).Methods(http.MethodGet)
	r.HandleFunc("/favicon.ico", getFavicon).Methods(http.MethodGet)
	r.HandleFunc("/liveViewOn", liveViewOn).Methods(http.MethodPost)
	r.HandleFunc("/liveViewOff", liveViewOff).Methods(http.MethodPost)
	//    r.HandleFunc("/", post).Methods(http.MethodPost)
	//    r.HandleFunc("/", put).Methods(http.MethodPut)
	//    r.HandleFunc("/", delete).Methods(http.MethodDelete)
	r.HandleFunc("/", notFound)
	log.Fatal(http.ListenAndServe(":8080", r))
}
