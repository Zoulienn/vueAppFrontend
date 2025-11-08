import lessons from "./lessons.js";

new Vue({
    el: '#app',
    data: {
        message: 'Classical Music Lessons',
        lessons: lessons,
        cart: [],
    },
    methods: {
        // returns the list of lessons
        displayLessons() {
            return this.lessons;
        },
        addToCart(lesson) {
            // guard: no spaces left
            if (lesson.spaces <= 0) return;

            // push a shallow copy into cart (so cart holds snapshot)
            this.cart.push({ ...lesson });

            // decrement the available spaces on the lesson
            lesson.spaces -= 1;
        }
    },
    computed: {

    }
});
