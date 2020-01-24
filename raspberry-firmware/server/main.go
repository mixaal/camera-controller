package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"sync"
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

const livePreviewFile string = "liveview.jpg"

type livePreview struct {
	mux     sync.RWMutex
	content []byte
	enabled bool
	elapsed time.Duration
}

const cameraQuit int = 0
const cameraLiveViewOn = 1
const cameraLiveViewOff = 2

type cameraCommand struct {
	cType int
}

var cameraEventQueue chan cameraCommand = make(chan cameraCommand, 100)
var preview livePreview = livePreview{enabled: false}

func streamPreview(w http.ResponseWriter, r *http.Request) {
	preview.mux.RLock()
	defer preview.mux.RUnlock()
	w.Header().Set("Content-Type", "application/octetstream")
	w.WriteHeader(http.StatusOK)
	w.Write(preview.content)
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
		fmt.Println(name + ":" + err.Error())
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

func turnLiveView(enabled bool) {
	for retry := 0; retry < 10; retry++ {
		var onOff int = 0
		if enabled {
			onOff = 1
		}
		err := int(C.camera_eosviewfinder(C.int(onOff)))
		if err == 0 {
			preview.enabled = enabled
			return
		}
	}
}

func captureDuration(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	millis := preview.elapsed.Nanoseconds() / 1000000
	out := strconv.FormatInt(millis, 10)
	fmt.Fprint(w, out)
}

func liveViewOff(w http.ResponseWriter, r *http.Request) {
	cameraEventQueue <- cameraCommand{cType: cameraLiveViewOff}
	w.WriteHeader(http.StatusAccepted)
}

func liveViewOn(w http.ResponseWriter, r *http.Request) {
	cameraEventQueue <- cameraCommand{cType: cameraLiveViewOn}
	w.WriteHeader(http.StatusAccepted)
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

func processCameraEventQueue(messageChannel chan cameraCommand) {
	for {
		select {
		case cmd, ok := <-messageChannel:
			if !ok {
				fmt.Println("Quit capture...")
				return
			}
			switch cmd.cType {
			case cameraQuit:
				fmt.Println("Quit capture...")
				return
			case cameraLiveViewOff:
				fmt.Println("Live view off...")
				turnLiveView(false)
			case cameraLiveViewOn:
				fmt.Println("Live view on...")
				turnLiveView(true)
			}
		default:
			if preview.enabled {
				startCapture := time.Now()
				C.capture_image()
				endCapture := time.Now()
				preview.mux.Lock()
				preview.content, _ = ioutil.ReadFile(livePreviewFile)
				preview.elapsed = endCapture.Sub(startCapture)
				preview.mux.Unlock()
			}
		}
	}
}

func main() {

	waitForCamera()
	turnLiveView(true)

	atexit.TrapSignals()
	defer atexit.CallExitFuncs()

	atexit.Run(func() {
		fmt.Println("Terminating liveview...")
		close(cameraEventQueue)
		time.Sleep(5 * time.Second)
		fmt.Println("Terminating camera...")
		turnLiveView(false)
		C.exit_camera()
	})

	go processCameraEventQueue(cameraEventQueue)

	fmt.Println("Starting server on :8080...")
	r := mux.NewRouter()
	r.HandleFunc("/liveview.jpg", streamPreview).Methods(http.MethodGet)
	r.HandleFunc("/", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/main.js", getMainJs).Methods(http.MethodGet)
	r.HandleFunc("/favicon.ico", getFavicon).Methods(http.MethodGet)
	r.HandleFunc("/liveView/on", liveViewOn).Methods(http.MethodPost)
	r.HandleFunc("/liveView/off", liveViewOff).Methods(http.MethodPost)
	r.HandleFunc("/liveView/duration", captureDuration).Methods(http.MethodGet)
	//    r.HandleFunc("/", post).Methods(http.MethodPost)
	//    r.HandleFunc("/", put).Methods(http.MethodPut)
	//    r.HandleFunc("/", delete).Methods(http.MethodDelete)
	r.HandleFunc("/", notFound)
	log.Fatal(http.ListenAndServe(":8080", r))
}
