import lessons from "./lessons.js";

new Vue({
    el: '#app',
    data: {
        message: 'Classical Music Lessons',
        lessons: lessons,
    },
    methods: {
        // returns the list of lessons
        displayLessons() {
            return this.lessons;
        }
    },
    computed: {

    }
});
