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

var app = new Vue({
    el: '#app',
    data: {
        liveViewImage: 'liveview.jpg',
        liveViewEnabled: true
    },
    methods: {
        toggleLiveView: function () {
            http = new XMLHttpRequest()
            if(this.liveViewEnabled) {
                this.liveViewEnabled = false
                http.open('POST', '/liveView/off')
                http.send()
            } else {
                this.liveViewEnabled = true
                http.open('POST', '/liveView/on')
                http.send()
            }
        },
    }
})
