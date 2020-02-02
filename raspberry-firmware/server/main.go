package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"bitbucket.org/JeremySchlatter/go-atexit"
	"github.com/gorilla/mux"
)

// #cgo CFLAGS: -I../ -I../../imageprocessor-dist
// #cgo LDFLAGS: -L../ -L../../imageprocessor-dist/x86_64/darwin -limageprocessor -ljpeg -lexif -lcamctrl -lgphoto2 -lgphoto2_port -lm
// #include <libcamctrl.h>
// #include <libmain.h>
import "C"

var imageChannel chan []byte
var hasPreview bool = true

const livePreviewFile string = "liveview.jpg"
const livePreviewHistogramFile string = "rgbhistogram.jpg"
const livePreviewLevelsFile string = "levels.jpg"

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

var skipCamera = false

var cameraEventQueue chan cameraCommand = make(chan cameraCommand, 100)
var preview livePreview = livePreview{enabled: false}
var previewHistogram livePreview = livePreview{enabled: false}
var previewLevels livePreview = livePreview{enabled: false}

// Profile body type
type Profile struct {
	Name string `json:"name"`
}

// helper method for in-memory content streaming
func streamContent(w http.ResponseWriter, r *http.Request, p *livePreview) {
	if !skipCamera && !p.enabled {
		w.WriteHeader(204)
		return
	}
	p.mux.RLock()
	defer p.mux.RUnlock()
	w.Header().Set("Content-Type", "application/octetstream")
	w.WriteHeader(http.StatusOK)
	w.Write(p.content)
}

func saveProfile(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading body: %v", err)
		http.Error(w, "can't read profile", http.StatusBadRequest)
		return
	}
	log.Printf("body" + string(body))
	var profile Profile
	json.Unmarshal(body, &profile)
	log.Printf("masrhsal")
	log.Printf(profile.Name)
	err = ioutil.WriteFile(profile.Name, body, 0644)
	if err != nil {
		log.Fatal(err)
		http.Error(w, "can't write profile", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// stream live preview
func streamPreview(w http.ResponseWriter, r *http.Request) {
	streamContent(w, r, &preview)
}

// stream live preview histogram
func streamPreviewHistogram(w http.ResponseWriter, r *http.Request) {
	streamContent(w, r, &previewHistogram)
}

// stream live preview levels
func streamPreviewLevels(w http.ResponseWriter, r *http.Request) {
	streamContent(w, r, &previewLevels)
}

// helper func to serve static files
func serveFile(w http.ResponseWriter, r *http.Request, name string, binary bool) {
	content, err := ioutil.ReadFile(name)

	if err == nil {
		if binary {
			w.Header().Set("Content-Type", "application/octetstream")
			w.WriteHeader(http.StatusOK)
			w.Write(content)
		} else {
			if strings.HasSuffix(name, "js") || strings.HasSuffix(name, "vue") {
				w.Header().Set("Content-Type", "text/javascript")
			}
			fmt.Fprint(w, string(content))
		}
	} else {
		fmt.Println(name + ":" + err.Error())
		http.NotFound(w, r)
	}
}

// get index.html file
func getIndex(w http.ResponseWriter, r *http.Request) {
	fmt.Println(r.URL)
	path := r.URL.String()
	if path == "/" {
		serveFile(w, r, "web/index.html", false)
	} else {
		serveFile(w, r, "web"+path, false)
	}
}

// turn on/off the live view capture with retry attempt on camera
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

// compute capture duration
func captureDuration(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	millis := preview.elapsed.Nanoseconds() / 1000000
	out := strconv.FormatInt(millis, 10)
	fmt.Fprint(w, out)
}

// send event for camera capture off
func liveViewOff(w http.ResponseWriter, r *http.Request) {
	cameraEventQueue <- cameraCommand{cType: cameraLiveViewOff}
	w.WriteHeader(http.StatusAccepted)
}

// send event for camera capture on
func liveViewOn(w http.ResponseWriter, r *http.Request) {
	cameraEventQueue <- cameraCommand{cType: cameraLiveViewOn}
	w.WriteHeader(http.StatusAccepted)
}

func liveViewHistogramOn(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Enable histogram")
	previewHistogram.enabled = true
	w.WriteHeader(http.StatusOK)
}

func liveViewHistogramOff(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Disable histogram")
	previewHistogram.enabled = false
	w.WriteHeader(http.StatusOK)
}

func liveViewLevelsOn(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Enable levels")
	previewLevels.enabled = true
	w.WriteHeader(http.StatusOK)
}

func liveViewLevelsOff(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Disable levels")
	previewLevels.enabled = false
	w.WriteHeader(http.StatusOK)
}

func notFound(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte(`{"message": "not found"}`))
}

// in the beginning wait for camera to attach
func waitForCamera() {
	for true {
		err := int(C.init_camera())
		if err == 0 {
			return
		}
		time.Sleep(2 * time.Second)
	}
}

// process camera commands in message channel, if no command sent process the live preview
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

				// histogram and levels processed only when preview enabled
				if previewHistogram.enabled {
					C.get_liveview_histogram()
					previewHistogram.mux.Lock()
					previewHistogram.content, _ = ioutil.ReadFile(livePreviewHistogramFile)
					previewHistogram.mux.Unlock()
				}
				if previewLevels.enabled {
					C.get_liveview_levels(1)
					previewLevels.mux.Lock()
					previewLevels.content, _ = ioutil.ReadFile(livePreviewLevelsFile)
					previewLevels.mux.Unlock()
				}
			} else {
				if skipCamera {
					if _, err := os.Stat(livePreviewFile); err == nil {
						// do we have the file at least?
						preview.mux.Lock()
						preview.content, _ = ioutil.ReadFile(livePreviewFile)
						preview.mux.Unlock()
					}
				}
			}
		}
	}
}

func main() {

	if os.Getenv("SKIP_CAMERA_INITIALIZATION") != "true" {
		waitForCamera()
		turnLiveView(true)
	} else {
		skipCamera = true
	}

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
	r.HandleFunc("/liveview/capture.jpg", streamPreview).Methods(http.MethodGet)
	r.HandleFunc("/liveview/histogram.jpg", streamPreviewHistogram).Methods(http.MethodGet)
	r.HandleFunc("/liveview/levels.jpg", streamPreviewLevels).Methods(http.MethodGet)
	r.HandleFunc("/", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/main.js", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/vue-color.min.js", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/vue-color.js", getIndex).Methods(http.MethodGet)
	r.HandleFunc("/liveView/capture/on", liveViewOn).Methods(http.MethodPost)
	r.HandleFunc("/liveView/capture/off", liveViewOff).Methods(http.MethodPost)
	r.HandleFunc("/liveView/histogram/on", liveViewHistogramOn).Methods(http.MethodPost)
	r.HandleFunc("/liveView/histogram/off", liveViewHistogramOff).Methods(http.MethodPost)
	r.HandleFunc("/liveView/levels/on", liveViewLevelsOn).Methods(http.MethodPost)
	r.HandleFunc("/liveView/levels/off", liveViewLevelsOff).Methods(http.MethodPost)
	r.HandleFunc("/liveView/duration", captureDuration).Methods(http.MethodGet)
	r.HandleFunc("/profiles/save", saveProfile).Methods(http.MethodPost)
	log.Fatal(http.ListenAndServe(":8080", r))
}
