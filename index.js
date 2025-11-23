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
        // call backend search API with current query
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
                let va = a[field];
                let vb = b[field];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                if (va < vb) return -1 * dir;
                if (va > vb) return 1 * dir;
                return 0;
            });

            return mapped;
        },
        addToCart(lesson, origIndex) {
            if (this.lessons[origIndex].spaces <= 0) return;

            const existing = this.cart.find(e => e.origIndex === origIndex);
            if (existing) {
                if (this.lessons[origIndex].spaces <= 0) return;
                existing.qty += 1;
            } else {
                this.cart.push({ subject: lesson.subject, price: lesson.price, origIndex, qty: 1, image: lesson.image });
            }

            this.lessons[origIndex].spaces -= 1;

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
            const origIndex = entry.origIndex;

            if (typeof origIndex === 'number' && this.lessons[origIndex]) {
                this.lessons[origIndex].spaces += 1;
            }

            entry.qty -= 1;
            if (entry.qty <= 0) {
                this.cart.splice(cidx, 1);
            }

            if (this.cart.length === 0) this.showCart = false;
        },
        increaseQuantity(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;
            const origIndex = entry.origIndex;

            if (typeof origIndex !== 'number' || !this.lessons[origIndex]) return;
            if (this.lessons[origIndex].spaces <= 0) return;

            entry.qty += 1;
            this.lessons[origIndex].spaces -= 1;
        },
        removeFromCart(cidx) {
            const entry = this.cart[cidx];
            if (!entry) return;

            const origIndex = entry.origIndex;
            if (typeof origIndex === 'number' && this.lessons[origIndex]) {
                this.lessons[origIndex].spaces += entry.qty;
            }

            this.cart.splice(cidx, 1);

            if (this.cart.length === 0) this.showCart = false;
        },
        isNameValid() {
            if (!this.order.name) return false;
            return /^[A-Za-z\s]+$/.test(this.order.name.trim());
        },
        isPhoneValid() {
            if (!this.order.phone) return false;
            return /^\d+$/.test(this.order.phone.trim());
        },
        checkout() {
            if (!this.isNameValid() || !this.isPhoneValid() || this.cart.length === 0) return;

            const items = this.cart.map(entry => {
                const lesson = this.lessons[entry.origIndex];
                const lessonSubject = lesson.subject; // use subject instead of id
                return { lessonSubject, qty: entry.qty };
            });

            const totalSpaces = items.reduce((s, it) => s + (it.qty || 0), 0);

            const orderPayload = {
                name: this.order.name.trim(),
                phone: this.order.phone.trim(),
                lessonSubjects: items.map(it => it.lessonSubject),
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
                    for (const item of items) {
                        const lesson = this.lessons.find(l => l.subject === item.lessonSubject);
                        if (!lesson) continue;

                        const newSpaces = lesson.spaces;

                        try {
                            await fetch(`https://vueappbackend.onrender.com/lessons/${encodeURIComponent(item.lessonSubject)}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ spaces: newSpaces })
                            });
                        } catch (err) {
                            console.error(`Failed to update lesson ${item.lessonSubject}:`, err);
                        }
                    }

                    const orderId = (responseData && (responseData.orderId || responseData.id || responseData._id)) || null;

                    this.order.submitted = true;
                    this.order.confirmationMessage = orderId
                        ? `Thank you ${this.order.name.trim()}! Your order (ID: ${orderId}) has been submitted.`
                        : `Thank you ${this.order.name.trim()}! Your order has been submitted.`;

                    this.cart = [];
                    this.order.showModal = true;

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
            return this.cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
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
                console.log("Lessons loaded from backend:", data);
            })
            .catch(err => {
                console.error("Error fetching lessons:", err);
            });
    }
});
