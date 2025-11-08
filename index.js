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
        },
        showCart: false,
        order: {
            name: '',
            phone: '',
            submitted: false,
            confirmationMessage: '',
            showModal: false
        }
    },
    methods: {
        // returns the list of lessons sorted according to `sort` and includes original index
        displayLessons() {
            const field = this.sort.field;
            const dir = this.sort.direction === 'asc' ? 1 : -1;

            // map lessons to include their original index so UI actions can reference back
            const mapped = this.lessons.map((l, i) => ({ ...l, origIndex: i }));

            mapped.sort((a, b) => {
                let va = a[field];
                let vb = b[field];

                // normalize strings
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();

                if (va < vb) return -1 * dir;
                if (va > vb) return 1 * dir;
                return 0;
            });

            return mapped;
        },
        addToCart(lesson, origIndex) {
            // guard: no spaces left
            if (this.lessons[origIndex].spaces <= 0) return;

            // see if this lesson already in cart
            const existing = this.cart.find(e => e.origIndex === origIndex);
            if (existing) {
                // increment quantity if there are spaces left
                if (this.lessons[origIndex].spaces <= 0) return;
                existing.qty += 1;
            } else {
                // push a new entry with qty 1 and include image
                this.cart.push({ subject: lesson.subject, price: lesson.price, origIndex, qty: 1, image: lesson.image });
            }

            // decrement the available spaces on the lesson (mutate original)
            this.lessons[origIndex].spaces -= 1;

            // clear any previous submission message when cart changes
            this.order.submitted = false;
            this.order.confirmationMessage = '';
        },
        toggleCart() {
            // only toggle if there is at least one item (button disabled otherwise)
            if (this.cart.length === 0) return;
            this.showCart = !this.showCart;
        },
        // decrease quantity by 1 (restore one space); if qty reaches 0 remove the entry
        decreaseQuantity(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;
            const origIndex = entry.origIndex;

            // restore a space to the lesson
            if (typeof origIndex === 'number' && this.lessons[origIndex]) {
                this.lessons[origIndex].spaces += 1;
            }

            entry.qty -= 1;
            if (entry.qty <= 0) {
                this.cart.splice(cidx, 1);
            }

            if (this.cart.length === 0) this.showCart = false;
        },
        // increase quantity by 1 if lesson has spaces available
        increaseQuantity(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;
            const origIndex = entry.origIndex;

            if (typeof origIndex !== 'number' || !this.lessons[origIndex]) return;
            if (this.lessons[origIndex].spaces <= 0) return; // no more spaces

            entry.qty += 1;
            this.lessons[origIndex].spaces -= 1;
        },
        // remove entire entry and restore all spaces
        removeFromCart(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;

            const origIndex = entry.origIndex;
            if (typeof origIndex === 'number' && this.lessons[origIndex]) {
                // restore as many spaces as the qty
                this.lessons[origIndex].spaces += entry.qty;
            }

            this.cart.splice(cidx, 1);

            if (this.cart.length === 0) this.showCart = false;
        },
        // validate name and phone using regex
        isNameValid() {
            if (!this.order.name) return false;
            // allow letters and spaces only
            return /^[A-Za-z\s]+$/.test(this.order.name.trim());
        },
        isPhoneValid() {
            if (!this.order.phone) return false;
            // numbers only
            return /^\d+$/.test(this.order.phone.trim());
        },
        checkout() {
            // only proceed when both valid and cart not empty
            if (!this.isNameValid() || !this.isPhoneValid() || this.cart.length === 0) return;

            // simulate submission: show confirmation message and clear cart
            this.order.submitted = true;
            this.order.confirmationMessage = `Thank you ${this.order.name.trim()}! Your order has been submitted.`;

            // clear the cart (do not restore spaces -- seats are taken)
            this.cart = [];

            // show modal popup
            this.order.showModal = true;

            // auto-close modal after 2.5s and return to lessons (homepage)
            setTimeout(() => {
                this.closeModal();
            }, 2500);
        },
        closeModal() {
            // hide modal and go back to lessons view
            this.order.showModal = false;
            this.showCart = false;

            // reset checkout form
            this.order.name = '';
            this.order.phone = '';

            // clear confirmation state after redirect
            this.order.submitted = false;
            this.order.confirmationMessage = '';
        }
    },
    computed: {
        totalPrice() {
            return this.cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
        },
        checkoutEnabled() {
            return this.isNameValid() && this.isPhoneValid() && this.cart.length > 0;
        }
    }
});
