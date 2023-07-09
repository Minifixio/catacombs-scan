export default class Loader {
    
    constructor(element) {
        this.element = element
        this.body = document.querySelector('body')
        this.bar = document.querySelector('.progress-bar')
        this.counter = document.querySelector('.count')
        this.spinningCircle = document.querySelector('.spinning-circle')
        this.background = document.querySelector('.loading-div')
        this.percentage = 0
        this.loading = false
    }


    load(self) {
        if (self.loading) {
            requestAnimationFrame(() => this.load(self));  
            self.bar.style.width = this.percentage + '%';
            self.counter.innerHTML = Math.round(self.percentage) + '%';
        }
    }

    update(percentage) {
        if (!this.loading) {
            this.loading = true
            this.bar.className = "progress-bar"
            this.counter.className = "count"
            this.spinningCircle.className = "spinning-circle"
            this.background.className = "loading-div";
            this.load(this)
        }
        this.percentage = percentage
        this.loading = true
    }

    finish() {
        this.loading = false
        setTimeout(() => {
            if (!this.loading) {
                console.log("done")
                this.background.className += " loading-div-done";
                this.counter.className += " count-done"
    
                // this.bar.className = "done";
                this.spinningCircle.className += " spinning-circle-done"
                this.loading = false
            }
        }, 500)
    }
}