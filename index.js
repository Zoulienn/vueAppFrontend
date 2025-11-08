import lessons from "./lessons.js";

new Vue({
    el: '#app',
    data: {
        message: 'Classical Music Lessons',
        lessons: lessons,
        cart: [],
        sort: {
            field: 'subject',
            direction: 'asc'
        }
    },
    methods: {
        // returns the list of lessons sorted according to `sort`
        displayLessons() {
            const field = this.sort.field;
            const dir = this.sort.direction === 'asc' ? 1 : -1;

            return this.lessons.slice().sort((a, b) => {
                let va = a[field];
                let vb = b[field];

                // normalize strings
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();

                if (va < vb) return -1 * dir;
                if (va > vb) return 1 * dir;
                return 0;
            });
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
