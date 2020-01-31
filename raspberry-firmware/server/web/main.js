

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

function tint(data, temp) {
    
    for (var i = 0; i < data.length; i += 4) {
        g = data[i+1] - temp;
        if (g<0) g = 0;
        if (g > COLOR_MAX) g = COLOR_MAX;
        data[i + 1] = g;
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

function rgbtext(color) {
    return "rgb("+color.r+","+color.g+","+color.b+")";
}

var Photoshop = VueColor.Photoshop

Vue.component('imageprocessor', {
    props: {
        source: {
            type: String,
            required: true,
            default: "canvas.jpg"
        }
    },
    components: {
        'photoshop-picker': Photoshop
    },
    template: `
    <div id="sketch">
        <table>
        <tr>
        <td>
        <canvas ref="paint"></canvas>
        </td>
        <td class="panel">
        <button id="fg_color" v-bind:style="fgc" @click="toggleFgPicker">FG</button>
        <photoshop-picker v-if="foreground_color_picker_enabled" id="foreground_picker" v-model="foreground_color" @ok="chooseFgColor" @cancel="toggleFgPicker"></photoshop-picker>

        <button id="fg_color" v-bind:style="bgc" @click="toggleBgPicker">BG</button>
        <photoshop-picker v-if="background_color_picker_enabled" id="background_picker" v-model="background_color" @ok="chooseBgColor" @cancel="toggleBgPicker"></photoshop-picker>
        <br/>

        <button v-on:click="reset_settings">Reset All</button>
        <br/>
        <p class="group">
        Vibrance 
        <input type="range" min="-0.5" max="0.5" value="0" step="0.01" class="slider" id="vibrance_scale" v-model="vibrance_scale" >
        {{vibrance_scale}}
        <button @click="vibrance_scale=0.0">Reset</button>
        </p>
        <br/>

        <p class="group">
        Contrast
        <input type="range" min="-128" max="128" value="0" step="1" class="slider" id="contrast_scale" v-model="contrast_scale" >
        {{contrast_scale}}
        <button @click="contrast_scale=0.0">Reset</button>
        </p>
        <br/>

        <p class="group">
        Exposure
        <input type="range" min="-3.5" max="3.5" value="0" step="0.01" class="slider" id="exposure_slider" v-model="exposure_scale" >
        {{exposure_scale}}
        <button @click="exposure_scale=0.0">Reset</button>
        </p>
        <br/>

        
        <p class="group">
        Tint
        <input type="range" min="-20" max="20" value="0" step="1" class="slider" id="tint_slider" v-model="tint_scale" >
        {{tint_scale}}
        <button @click="tint_scale=0.0">Reset</button>
        </p>
        <br/>

        <p class="group">
        Gradient Map
        <table>
        <tr>
        <td>Weight</td>
        <td class="mainpanel"><input type="range" min="0.0" max="1.0" value="0.5" step="0.02" class="slider" id="gradient_map_weight" v-bind:style="gmap_gradient" v-model="gmap_weight" ></td>
        <td>{{gmap_weight}}</td>
        </tr>
        <tr>
        <td>Opacity</td>
        <td class="mainpanel"><input type="range" min="0.0" max="1.0" value="0.0" step="0.02" class="slider" id="gradient_map_opacity" v-model="gmap_opacity" ></td>
        <td>{{gmap_opacity}}</td>
        </tr>
        </table>
        
        <table>
        <tr>
        <td>
        <button @click="reset_gmap">Reset</button>
        </td>
        <td align="right">
        <label class="switch">
        <input type="checkbox" checked v-model="gmap_lock">
        <span class="swslider round"></span>
        </label>
        </td>
        <td>Lock
        </td
        </tr>
        </table>
        </p>
        <p class="group">
        Tone Map <br/>
        <input type="checkbox" id="checkbox" v-model="tone_preserve_luminosity">Preserve luminosity
        <input type="radio" name="levels" value="0"  @click="color_tone_settings(0)">Highlights</input>
        <input type="radio" name="levels" value="1"  @click="color_tone_settings(1)" checked>Midtones</input>
        <input type="radio" name="levels" value="2"  @click="color_tone_settings(2)">Shadows</input>
        <table>
        <tr>
        <td>azure</td>
        <td class="mainpanel">
        <input type="range" min="-100" max="100.0" value="0" step="0.1" class="slider"  id="color_cyan_red" v-model="tone_cyan_red" @change="color_tone_move">
        </td>
        <td>red</td>
        </tr>
        <tr>
        <td>magenta</td>
        <td class="mainpanel">
        <input type="range" min="-100" max="100.0" value="0" step="0.1" class="slider"  id="color_magenta_green" v-model="tone_magenta_green" @change="color_tone_move">
        </td>
        <td>green</td>
        </tr>
        <tr>
        <td>yellow</td>
        <td class="mainpanel">
        <input type="range" min="-100" max="100.0" value="0" step="0.1" class="slider"  id="color_yellow_blue" v-model="tone_yellow_blue" @change="color_tone_move">
        </td>
        <td>
        blue
        </td>
        </tr>
        </table>
        <button @click="reset_color_tone">Reset</button>
        </p>
        </td>
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
            foreground_color_picker_enabled: false,
            background_color_picker_enabled: false,
            foreground_color: { 
               r: 255, g: 255, b: 255
            },
            background_color: { r: 0, g: 0, b: 0 },
            vibrance_scale: 0.0,
            contrast_scale: 0.0,
            exposure_scale: 0.0,
            tint_scale: 0.0,
            gmap_weight: 0.5,
            gmap_opacity: 0.0,
            gmap_lock: false,
            gmap_fg: {r:255, g:255, b:255},
            gmap_bg: {r:0, g:0, b:0},

            tone_cyan_red: 0.0,
            tone_magenta_green: 0.0,
            tone_yellow_blue: 0.0,

            highlights: {
                cyan_red: 0.0,
                magenta_green: 0.0,
                yellow_blue: 0.0
            },
            midtones: {
                cyan_red: 0.0,
                magenta_green: 0.0,
                yellow_blue: 0.0
            },
            shadows: {
                cyan_red: 0.0,
                magenta_green: 0.0,
                yellow_blue: 0.0
            },
            
            tone_levels: 1,
            tone_preserve_luminosity: false,
            bgc: {
                backgroundColor: '#000000'
            },
            fgc: {
                backgroundColor: '#ffffff'
            },
            gmap_gradient: {
                background: 'linear-gradient(to right, rgb(0,0,0) , rgb(255,255,255) )'
            }


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
        chooseFgColor() {
            this.toggleFgPicker();
            this.fgc.backgroundColor = this.foreground_color.hex;
            this.foreground_color.r = this.foreground_color.rgba.r;
            this.foreground_color.g = this.foreground_color.rgba.g;
            this.foreground_color.b = this.foreground_color.rgba.b;
            if(!this.gmap_lock) {
                this.gmap_fg = this.foreground_color;
                this.gmap_bg = this.background_color;
                this.gmap_style();
            }
        },
        chooseBgColor() {
            this.toggleBgPicker();
            this.bgc.backgroundColor = this.background_color.hex;
            this.background_color.r = this.background_color.rgba.r;
            this.background_color.g = this.background_color.rgba.g;
            this.background_color.b = this.background_color.rgba.b;
            if(!this.gmap_lock) {
                this.gmap_fg = this.foreground_color;
                this.gmap_bg = this.background_color;
                this.gmap_style();
            }
        },
        gmap_style() {
            sb = rgbtext(this.gmap_bg);
            sf = rgbtext(this.gmap_fg);
            str = 'linear-gradient(to right, '+sb+' ,'+sf+' )';
            this.gmap_gradient.background = str;
        },
        toggleFgPicker() {
            this.foreground_color_picker_enabled = !this.foreground_color_picker_enabled;
        },
        toggleBgPicker() {
            this.background_color_picker_enabled = !this.background_color_picker_enabled;
        },
        image_src() {
            return this.source+"?random="+this.currentRandom
        },
        reset_gmap() {
            this.gmap_weight=0.5;
            this.gmap_opacity= 0.0;
            this.gmap_lock=false;
            this.gmap_fg={r:255, g:255, b:255};
            this.gmap_bg={r:0, g:0, b:0};
            this.gmap_style();
        },
        reset_color_tone() {
            this.highlights.cyan_red = 0.0;
            this.highlights.magenta_green = 0.0;
            this.highlights.yellow_blue = 0.0;
            this.midtones.cyan_red = 0.0;
            this.midtones.magenta_green = 0.0;
            this.midtones.yellow_blue = 0.0;
            this.shadows.cyan_red = 0.0;
            this.shadows.magenta_green = 0.0;
            this.shadows.yellow_blue = 0.0;
            this.tone_cyan_red = 0.0;
            this.tone_magenta_green = 0.0;
            this.tone_yellow_blue = 0.0;
            this.tone_levels = 1;
            this.tone_preserve_luminosity = false;
        },
        color_tone_move() {
            //console.log("this.levels="+this.tone_levels);
            switch (this.tone_levels) {
                case 2:
                    this.highlights.cyan_red = this.tone_cyan_red;
                    this.highlights.magenta_green = this.tone_magenta_green;
                    this.highlights.yellow_blue = this.tone_yellow_blue;
                    break;
                case 1:
                    this.midtones.cyan_red = this.tone_cyan_red;
                    this.midtones.magenta_green = this.tone_magenta_green;
                    this.midtones.yellow_blue = this.tone_yellow_blue;
                    break;
                case 0:
                    this.shadows.cyan_red = this.tone_cyan_red;
                    this.shadows.magenta_green = this.tone_magenta_green;
                    this.shadows.yellow_blue = this.tone_yellow_blue;
                    break
            }
        },

        color_tone_settings(c) {
            this.tone_levels = c;
            //alert(this.tone_levels);
            switch(this.tone_levels) {
                case 2:
                    this.tone_cyan_red = this.highlights.cyan_red;
                    this.tone_magenta_green = this.highlights.magenta_green;
                    this.tone_yellow_blue = this.highlights.yellow_blue;
                    break;
                case 1:
                    this.tone_cyan_red = this.midtones.cyan_red;
                    this.tone_magenta_green = this.midtones.magenta_green;
                    this.tone_yellow_blue = this.midtones.yellow_blue;
                    break;
                case 0:
                    this.tone_cyan_red = this.shadows.cyan_red;
                    this.tone_magenta_green = this.shadows.magenta_green;
                    this.tone_yellow_blue = this.shadows.yellow_blue;
                    break;
                default:
                    alert("Set one of shadows, midtones or highlights to slide!");
            }
        },

        reset_settings() {
            this.exposure_scale = 0.0;
            this.contrast_scale = 0.0;
            this.vibrance_scale = 0.0;
            this.tint_scale = 0.0;
            this.reset_color_tone();
            this.reset_gmap();
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
            var tscale = this.tint_scale;
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
                if (tscale<0 || tscale>0) {
                    tint(data, tscale);
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
    <button v-on:click="toggleButton">
    <p v-if="this.liveViewEnabled">
        {{ text }} (on)
    </p>
    <p v-else="this.liveViewEnabled">
        {{ text }} (off)
    </p>
    </button>
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
