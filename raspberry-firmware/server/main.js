const COLOR_MAX = 255;
const COLOR_MID = 128;

function to_gray(r, g, b) {
    return 0.3*r + 0.6*g + 0.1*b;
}

function maxf(a, b, c) {
    m = a;
    if (b>a) m = a;
    if (c>m) m = c;
    return c;
}

function minf(a, b, c) {
    m = a;
    if (b<a) m = a;
    if (c<m) m = c;
    return c;
}

function fabs(x) {
    if(x>=0) return x;
    return -x;
}

function contrast(data, c) {
    c = Number(c)
    dx = c + COLOR_MAX;
    dy = 259.0 - c;
    Fx = 259.0 * dx;
    Fy = COLOR_MAX * dy;
    F = Fx / Fy;
    for (var i = 0; i < data.length; i += 4) {
        r = data[i] - COLOR_MID;
        g = data[i+1] - COLOR_MID;
        b = data[i+2] - COLOR_MID;

        r *= F;
        g *= F;
        b *= F;

        r += COLOR_MID;
        g += COLOR_MID;
        b += COLOR_MID;
        if (r<0) r = 0;
        if (g<0) g = 0;
        if (b<0) b = 0;
        if (r > COLOR_MAX) r = COLOR_MAX;
        if (g > COLOR_MAX) g = COLOR_MAX;
        if (b > COLOR_MAX) b = COLOR_MAX; 
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
}

function exposure(data, e) {
    e = Number(e)
    p = Math.pow(2, e);
    for (var i = 0; i < data.length; i += 4) {
        r = data[i]  ;
        g = data[i+1];
        b = data[i+2];

        r *= p;
        g *= p;
        b *= p;

        if (r<0) r = 0;
        if (g<0) g = 0;
        if (b<0) b = 0;
        if (r > COLOR_MAX) r = COLOR_MAX;
        if (g > COLOR_MAX) g = COLOR_MAX;
        if (b > COLOR_MAX) b = COLOR_MAX; 
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
}

function vibrance(data, scale) {
    for (var i = 0; i < data.length; i += 4) {
        r = data[i];
        g = data[i+1];
        b = data[i+2];
        x = maxf(r, g, b);
        y = minf(r, g, b);

        gray = to_gray(r, g, b);
        if (x == r && x!=y) {
            t  = fabs((g - b) / ( x - y ));
            if (t > 1.0) t = 1.0;
            scale = scale * (1+t) * 0.5;
        }
        a = (x - y) / COLOR_MAX;
        scale1 = scale * (2 - a);
        scale2 = 1 + scale1 * (1 - a);
        sub = y * scale1;
        r = r * scale2  - sub;
        g = g * scale2  - sub;
        b = b * scale2  - sub;

        gray2 = to_gray(r, g, b);

        r *= gray/gray2;
        g *= gray/gray2;
        b *= gray/gray2;

        m = maxf( r, g, b );

        if ( m > COLOR_MAX ) {
            scale = (COLOR_MAX - gray2) / (m - gray2);
            r = (r - gray2) * scale + gray2;
            g = (g - gray2) * scale + gray2;
            b = (b - gray2) * scale + gray2;
        }
        if (r > COLOR_MAX) r = COLOR_MAX;
        if (g > COLOR_MAX) g = COLOR_MAX;
        if (b > COLOR_MAX) b = COLOR_MAX;
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
}

function black_and_white(data) {
    for (var i = 0; i < data.length; i += 4) {
        r = data[i];
        g = data[i+1];
        b = data[i+2];
        data[i] = data[i+1] = data[i+2] = (r + g + b) / 3;
    }
}

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
        <table>
        <tr>
        <td>
        <canvas ref="paint"></canvas>
        </td>
        <td>
        Vibrance<br/>
        <input type="range" min="-0.5" max="0.5" value="0" step="0.01" class="slider" id="vibrance_scale" v-model="vibrance_scale" ><br/>
        {{vibrance_scale}}<br/>

        Contrast<br/>
        <input type="range" min="-128" max="128" value="0" step="1" class="slider" id="vibrance_scale" v-model="contrast_scale" ><br/>
        {{contrast_scale}}<br/>

        Exposure<br/>
        <input type="range" min="-3.5" max="3.5" value="0" step="0.01" class="slider" id="vibrance_scale" v-model="exposure_scale" ><br/>
        {{exposure_scale}}<br/>
        </td>
        </tr>
        </table>
    </div>
    `,
    data () {
        return {
            currentRandom: 0,
            mounted: false,
            timer: '',
            vibrance_scale: 0.0,
            contrast_scale: 0.0,
            exposure_scale: 0.0
        }
    },
    created () {
        this.mounted = false;
        this.paint();
        this.timer = setInterval(this.paint, 300);
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
            var vscale = this.vibrance_scale;
            var cscale = this.contrast_scale;
            var escale = this.exposure_scale;
            //img.crossOrigin = '';
            img.onload=function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var data = image.data;
                
                if(vscale<-0.01 || vscale>0.01) {
                    vibrance(data, vscale);
                }
                if (cscale<0 || cscale > 0) {
                    contrast(data, cscale);
                }
                if (escale<-0.01 || escale>0.01) {
                    exposure(data, escale);
                }
                //black_and_white(data);
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
