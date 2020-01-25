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
