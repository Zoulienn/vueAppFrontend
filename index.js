new Vue({
    el: '#app',
    data: {
        message: 'Classical Music Lessons',
        lessons: [],
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

            // build order payload: include name, phone, and details about lessons ordered
            const items = this.cart.map(entry => {
                const lesson = this.lessons[entry.origIndex];
                // use real id if available, else use the original index as an identifier
                const lessonId = lesson && (lesson.id !== undefined ? lesson.id : entry.origIndex);
                return { lessonId, qty: entry.qty };
            });

            const totalSpaces = items.reduce((s, it) => s + (it.qty || 0), 0);

            const orderPayload = {
                name: this.order.name.trim(),
                phone: this.order.phone.trim(),
                // minimal required fields: lessonIDs (array) and spaces (total number)
                lessonIDs: items.map(it => it.lessonId),
                spaces: totalSpaces,
                // keep detailed items for backend convenience
                items
            };

            // send order to backend
            fetch('/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            })
                .then(res => {
                    if (!res.ok) throw new Error(`Server responded ${res.status}`);
                    return res.json().catch(() => ({}));
                })
                .then(async responseData => {
                    // success: mark submitted, show confirmation message, clear cart and show modal
                    const orderId = (responseData && (responseData.orderId || responseData.id || responseData._id)) || null;

                    // Send one PUT request per lesson that was in the order
                    for (const item of items) {
                        const lesson = this.lessons.find(l => l.id === item.lessonId);
                        if (!lesson) continue;

                        // Calculate new available spaces after purchase
                        const newSpaces = lesson.spaces;

                        try {
                            await fetch(`/lessons/${item.lessonId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ spaces: newSpaces })
                            });
                        } catch (err) {
                            console.error(`Failed to update lesson ${item.lessonId}:`, err);
                        }
                    }

                    this.order.submitted = true;
                    this.order.confirmationMessage = orderId
                        ? `Thank you ${this.order.name.trim()}! Your order (ID: ${orderId}) has been submitted.`
                        : `Thank you ${this.order.name.trim()}! Your order has been submitted.`;

                    // clear the cart
                    this.cart = [];

                    // show modal popup
                    this.order.showModal = true;

                    // auto-close modal after 2.5s and return to lessons
                    setTimeout(() => {
                        this.closeModal();
                    }, 2500);
                })
                .catch(err => {
                    console.error('Order submission failed:', err);
                    this.order.submitted = false;
                    this.order.confirmationMessage = 'There was an error submitting your order. Please try again.';
                    this.order.showModal = true;
                });
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
    },
    created() {
        // fetch lessons from backend server
        fetch('/lessons')
            .then(res => res.json())
            .then(data => {
                this.lessons = data;
                console.log("Lessons loaded from backend:", data);
            })
            .catch(err => {
                console.error("Error fetching lessons:", err);
            });
    },

});
