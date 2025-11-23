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
        },
        searchQuery: ''
    },
    methods: {
        async performSearch(q) {
            try {
                const url = 'https://vueappbackend.onrender.com/search' + (q && q.trim().length > 0 ? `?q=${encodeURIComponent(q)}` : '');
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Search failed: ${res.status}`);
                const data = await res.json();
                this.lessons = data;
            } catch (err) {
                console.error('Search error:', err);
            }
        },
        onSearchInput(event) {
            const q = (event && event.target) ? event.target.value : (typeof event === 'string' ? event : '');
            this.searchQuery = q;
            this.performSearch(q);
        },
        displayLessons() {
            const field = this.sort.field;
            const dir = this.sort.direction === 'asc' ? 1 : -1;
            const mapped = this.lessons.map((l, i) => ({ ...l, origIndex: i }));

            mapped.sort((a, b) => {
                let va = a[field], vb = b[field];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                if (va < vb) return -1 * dir;
                if (va > vb) return 1 * dir;
                return 0;
            });
            return mapped;
        },
        addToCart(lesson, origIndex) {
            if (lesson.spaces <= 0) return;

            const existing = this.cart.find(e => e.subject === lesson.subject);
            if (existing) {
                if (lesson.spaces <= 0) return;
                existing.qty += 1;
            } else {
                this.cart.push({
                    subject: lesson.subject,
                    price: lesson.price,
                    origIndex,
                    qty: 1,
                    image: lesson.image
                });
            }

            lesson.spaces -= 1;
            this.order.submitted = false;
            this.order.confirmationMessage = '';
        },
        toggleCart() {
            if (this.cart.length === 0) return;
            this.showCart = !this.showCart;
        },
        decreaseQuantity(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;
            const lesson = this.lessons[entry.origIndex];
            if (lesson) lesson.spaces += 1;

            entry.qty -= 1;
            if (entry.qty <= 0) this.cart.splice(cidx, 1);
            if (this.cart.length === 0) this.showCart = false;
        },
        increaseQuantity(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;
            const lesson = this.lessons[entry.origIndex];
            if (!lesson || lesson.spaces <= 0) return;

            entry.qty += 1;
            lesson.spaces -= 1;
        },
        removeFromCart(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;
            const lesson = this.lessons[entry.origIndex];
            if (lesson) lesson.spaces += entry.qty;

            this.cart.splice(cidx, 1);
            if (this.cart.length === 0) this.showCart = false;
        },
        isNameValid() {
            return /^[A-Za-z\s]+$/.test(this.order.name.trim());
        },
        isPhoneValid() {
            return /^\d+$/.test(this.order.phone.trim());
        },
        checkout() {
            if (!this.isNameValid() || !this.isPhoneValid() || this.cart.length === 0) return;

            // include subject in items
            const items = this.cart.map(entry => ({
                subject: entry.subject,
                qty: entry.qty
            }));

            const totalSpaces = items.reduce((s, it) => s + it.qty, 0);

            const orderPayload = {
                name: this.order.name.trim(),
                phone: this.order.phone.trim(),
                lessonSubjects: items.map(it => it.subject),
                spaces: totalSpaces,
                items
            };

            fetch('https://vueappbackend.onrender.com/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            })
                .then(res => {
                    if (!res.ok) throw new Error(`Server responded ${res.status}`);
                    return res.json().catch(() => ({}));
                })
                .then(async responseData => {
                    // update spaces in backend
                    for (const item of items) {
                        const lesson = this.lessons.find(l => l.subject === item.subject);
                        if (!lesson) continue;

                        const newSpaces = lesson.spaces;

                        try {
                            await fetch(`https://vueappbackend.onrender.com/lessons/${encodeURIComponent(item.subject)}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ spaces: newSpaces })
                            });
                        } catch (err) {
                            console.error(`Failed to update lesson ${item.subject}:`, err);
                        }
                    }

                    this.order.submitted = true;
                    this.order.confirmationMessage = responseData?.orderId
                        ? `Thank you ${this.order.name.trim()}! Your order (ID: ${responseData.orderId}) has been submitted.`
                        : `Thank you ${this.order.name.trim()}! Your order has been submitted.`;

                    this.cart = [];
                    this.order.showModal = true;
                    setTimeout(() => this.closeModal(), 2500);
                })
                .catch(err => {
                    console.error('Order submission failed:', err);
                    this.order.submitted = false;
                    this.order.confirmationMessage = 'There was an error submitting your order. Please try again.';
                    this.order.showModal = true;
                });
        },
        closeModal() {
            this.order.showModal = false;
            this.showCart = false;
            this.order.name = '';
            this.order.phone = '';
            this.order.submitted = false;
            this.order.confirmationMessage = '';
        }
    },
    computed: {
        totalPrice() {
            return this.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        },
        checkoutEnabled() {
            return this.isNameValid() && this.isPhoneValid() && this.cart.length > 0;
        }
    },
    created() {
        fetch('https://vueappbackend.onrender.com/lessons')
            .then(res => res.json())
            .then(data => {
                this.lessons = data;
                console.log("Lessons loaded:", data);
            })
            .catch(err => console.error("Error fetching lessons:", err));
    }
});
