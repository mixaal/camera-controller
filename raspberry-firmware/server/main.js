Vue.component('imageprocessor', {
    props: {
        source: {
            type: String,
            required: true,
            default: "canvas.jpg"
        }
    },
    template: `
    <div id="sketch">
        <canvas ref="paint"></canvas>
    </div>
    `,
    data () {
        return {
            currentRandom: 0,
            mounted: false,
            timer: ''
        }
    },
    created () {
        this.mounted = false;
        this.paint();
        this.timer = setInterval(this.paint, 1000);
    },
    mounted () {
        this.mounted = true;
    },
    methods: {
        image_src() {
            return this.source+"?random="+this.currentRandom
        },
        paint() {
            if (!this.mounted) return;
            this.currentRandom = Math.random();
            var canvas = this.$refs.paint;
            var ctx = canvas.getContext('2d');
        
            var img = new Image();
            //img.crossOrigin = '';
            img.onload=function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                var image = ctx.getImageData(0, 0, 100, 100);
                var data = image.data;
                for (var i = 0; i < data.length; i += 4) {
                    data[i]     = 255 - data[i];     // red
                    data[i + 1] = 255 - data[i + 1]; // green
                    data[i + 2] = 255 - data[i + 2]; // blue
                }
                ctx.putImageData(image, 0, 0);
            }
            //img.crossOrigin = "anonymous";
            img.src = this.image_src();


        }    
    },
    beforeDestroy () {
        clearInterval(this.timer)
    }
}
)


Vue.component('capture', {
    props: {
        source: {
            type: String,
            required: true,
            default: "liveview.jpg"
        }
    },
    template: `
    <div>
    <img :src="image" />
    </div>
    `,
    computed: {
        image() {
            return this.source+"?random="+this.currentRandom
        }
    },
    data () {
        return {
            currentRandom: 0,
            timer: ''
        }
    },
    created () {
        this.fetchEventsList();
        this.timer = setInterval(this.fetchEventsList, 300)
    },
    methods: {
        
        fetchEventsList () {
                this.currentRandom = Math.random()
            
        },
        cancelAutoUpdate () { clearInterval(this.timer) }

    },
    beforeDestroy () {
      clearInterval(this.timer)
    }
});

Vue.component('toggle-button', {
    props: {
        text: {
            type: String,
            required: true,
            default: "Toggle"
        },
        onuri: {
            type: String,
            required: true,
            default: ""
        },
        offuri: {
            type: String,
            required: true,
            default: ""
        },
        onstart: {
            type: Boolean,
            required: true,
            default: false
        }
    },
    template: `
    <div>
    <button v-on:click="toggleButton">{{ text }}</button>
    <p v-if="this.liveViewEnabled">
       Currently enabled
    </p>
    <p v-else="this.liveViewEnabled">
       Currently disabled
    </p>
    </div>
    `,
    
    data () {
        return {
            liveViewEnabled: this.onstart,
            _uriOn: this.onuri,
            _uriOff: this.offuri
        }
    },
    created () {
        this.liveViewEnabled = this.onstart
    },
    methods: {
        toggleButton: function () {
            http = new XMLHttpRequest()
            if(this.liveViewEnabled) {
                this.liveViewEnabled = false
                http.open('POST', this.offuri)
                http.send()
            } else {
                this.liveViewEnabled = true
                http.open('POST', this.onuri)
                http.send()
            }
        },
      

    },
    beforeDestroy () {
      
    }
});


var app = new Vue({
    el: '#app',
    data: {
        liveViewImage: 'liveview.jpg'
    }
})
