/* Homepage enhancements: loaded only on homepage for performance. */
'use strict';

(function initBaderHomepage() {

        // ---- 3. Testimonials Carousel ----
        var slides = document.querySelectorAll('.bader-testimonial-slide');
        var dots = document.querySelectorAll('.bader-testimonials__dot');
        var prevBtn = document.getElementById('testimonialPrev');
        var nextBtn = document.getElementById('testimonialNext');
        var currentSlide = 0;
        var totalSlides = slides.length;

        function showSlide(index) {
            if (totalSlides === 0) return;
            currentSlide = ((index % totalSlides) + totalSlides) % totalSlides;

            slides.forEach(function (slide) {
                slide.style.display = 'none';
                slide.classList.remove('active');
            });
            dots.forEach(function (dot) { dot.classList.remove('active'); });

            if (slides[currentSlide]) {
                slides[currentSlide].style.display = 'block';
                slides[currentSlide].classList.add('active');
            }
            if (dots[currentSlide]) {
                dots[currentSlide].classList.add('active');
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () { showSlide(currentSlide - 1); });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', function () { showSlide(currentSlide + 1); });
        }
        dots.forEach(function (dot) {
            dot.addEventListener('click', function () {
                showSlide(parseInt(this.getAttribute('data-slide'), 10));
            });
        });

        if (totalSlides > 1) {
            setInterval(function () { showSlide(currentSlide + 1); }, 5000);
        }

        // ---- 5. Hero Persona Tab Switching ----
        (function initPersonaTabs() {
            var tabs = document.querySelectorAll('.bader-hero__tab[data-persona]');
            if (tabs.length === 0) return;
            var personas = ['clinica', 'laboratorio', 'estudiantes'];
            var wrap = document.getElementById('wrap');
            var defaultPersona = (wrap && wrap.getAttribute('data-bader-home-persona')) || '';
            var isLockedPersona = (wrap && wrap.getAttribute('data-bader-home-persona-locked') === '1');
            var canAutoRotate = (wrap && wrap.getAttribute('data-bader-home-persona-autorotate') === '1');
            var urlParams = new URLSearchParams(window.location.search || '');
            var queryPersona = (urlParams.get('persona') || urlParams.get('perfil') || urlParams.get('niche') || '').toLowerCase();
            var storedPersona = '';
            try {
                storedPersona = (window.localStorage.getItem('bader_home_persona') || '').toLowerCase();
            } catch (err) {
                storedPersona = '';
            }
            if (personas.indexOf(queryPersona) !== -1) {
                defaultPersona = queryPersona;
                canAutoRotate = false;
            } else if (personas.indexOf(storedPersona) !== -1) {
                defaultPersona = storedPersona;
                canAutoRotate = false;
            }
            if (personas.indexOf(defaultPersona) === -1) {
                defaultPersona = 'clinica';
            }

            var personaMeta = {
                clinica: {
                    stats: [
                        { value: '10,000+', label: 'Clientes satisfechos' },
                        { value: '4.7', label: 'Google Reviews' },
                        { value: '1,300+', label: 'Productos' },
                    ],
                    cta: { label: 'Equipar mi clinica', href: '/clinica-dental' },
                    testimonial: {
                        text: 'Los equipos Bader transformaron la experiencia de mis pacientes. Es como tener tecnologia del futuro hoy.',
                        author: 'Dra. Maria Garcia',
                        role: 'Odontologa, Buenos Aires',
                    },
                },
                laboratorio: {
                    stats: [
                        { value: '800+', label: 'Distribuidores' },
                        { value: '1,300+', label: 'Productos' },
                        { value: '24/7', label: 'Soporte tecnico' },
                    ],
                    cta: { label: 'Ver equipos para lab', href: '/laboratorio-dental' },
                    testimonial: {
                        text: 'La calidad de nuestras piezas mejoro un 40% desde que usamos equipos Bader.',
                        author: 'Tec. Carlos Rodriguez',
                        role: 'Lab Dental Premium, Cordoba',
                    },
                },
                estudiantes: {
                    stats: [
                        { value: '10,000+', label: 'Clientes' },
                        { value: '12', label: 'Cuotas sin interes' },
                        { value: '800+', label: 'Distribuidores' },
                    ],
                    cta: { label: 'Plan estudiantes', href: '/estudiantes-odontologia' },
                    testimonial: {
                        text: 'Gracias al plan estudiantes pude equipar mi primer consultorio antes de graduarme.',
                        author: 'Lucas Mendoza',
                        role: 'Estudiante UBA, 5to ano',
                    },
                },
            };

            function applyPersonaMeta(persona) {
                var meta = personaMeta[persona] || personaMeta.clinica;
                var statNumbers = document.querySelectorAll('.bader-hero__inline-stats .bader-hero__stat-num');
                var statLabels = document.querySelectorAll('.bader-hero__inline-stats .bader-hero__stat-label');
                var i = 0;

                for (i = 0; i < statNumbers.length && i < meta.stats.length; i++) {
                    statNumbers[i].textContent = meta.stats[i].value;
                }
                for (i = 0; i < statLabels.length && i < meta.stats.length; i++) {
                    statLabels[i].textContent = meta.stats[i].label;
                }

                var ctaBtn = document.querySelector('.bader-hero__actions .btn-bader');
                if (ctaBtn) {
                    ctaBtn.setAttribute('href', meta.cta.href);
                    ctaBtn.textContent = meta.cta.label + ' ';
                    var icon = document.createElement('i');
                    icon.className = 'fa fa-arrow-right';
                    ctaBtn.appendChild(icon);
                }

                var testimonialText = document.querySelector('.bader-hero__testimonial-text');
                if (testimonialText) {
                    testimonialText.textContent = '"' + meta.testimonial.text + '"';
                }

                var testimonialAuthor = document.querySelector('.bader-hero__testimonial-author strong');
                if (testimonialAuthor) {
                    testimonialAuthor.textContent = meta.testimonial.author;
                }

                var testimonialRole = document.querySelector('.bader-hero__testimonial-author span');
                if (testimonialRole) {
                    testimonialRole.textContent = meta.testimonial.role;
                }
            }

            function personaIndex(persona) {
                var idx = personas.indexOf(persona);
                return idx === -1 ? 0 : idx;
            }

            function switchPersona(persona) {
                // Tabs
                tabs.forEach(function (t) {
                    t.classList.toggle('bader-hero__tab--active', t.getAttribute('data-persona') === persona);
                });
                // Text content blocks
                document.querySelectorAll('[data-persona-content]').forEach(function (el) {
                    var isMatch = el.getAttribute('data-persona-content') === persona;
                    el.style.display = isMatch ? '' : 'none';
                    el.classList.toggle('bader-hero__persona--active', isMatch);
                });
                // Hero images
                document.querySelectorAll('[data-persona-img]').forEach(function (img) {
                    var isMatch = img.getAttribute('data-persona-img') === persona;
                    img.style.display = isMatch ? '' : 'none';
                    img.classList.toggle('bader-hero__persona-img--active', isMatch);
                });
                // Bottom progress indicators
                document.querySelectorAll('[data-persona-indicator]').forEach(function (dot) {
                    dot.classList.toggle('is-active', dot.getAttribute('data-persona-indicator') === persona);
                });

                applyPersonaMeta(persona);
            }

            function persistPersona(persona) {
                if (!window.fetch || personas.indexOf(persona) === -1) return;
                try {
                    window.localStorage.setItem('bader_home_persona', persona);
                } catch (err) {
                    // Ignore storage errors.
                }
                fetch('/bader/home/set_persona', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: { persona: persona },
                    }),
                }).catch(function () {
                    // Keep UX working even if persistence fails.
                });
            }

            tabs.forEach(function (tab) {
                tab.addEventListener('click', function (e) {
                    e.preventDefault();
                    var persona = this.getAttribute('data-persona');
                    currentIdx = personaIndex(persona);
                    switchPersona(persona);
                    persistPersona(persona);
                });
            });

            // Also clicking progress indicators switches persona
            document.querySelectorAll('[data-persona-indicator]').forEach(function (dot) {
                dot.addEventListener('click', function () {
                    var persona = this.getAttribute('data-persona-indicator');
                    currentIdx = personaIndex(persona);
                    switchPersona(persona);
                    persistPersona(persona);
                });
            });

            // Initial persona from server/session and optional auto-rotation.
            var currentIdx = personaIndex(defaultPersona);
            switchPersona(personas[currentIdx]);
            if (personas.indexOf(queryPersona) !== -1) {
                persistPersona(defaultPersona);
            }
            if (!isLockedPersona && canAutoRotate) {
                setInterval(function () {
                    currentIdx = (currentIdx + 1) % personas.length;
                    switchPersona(personas[currentIdx]);
                }, 6000);
            }
        })();

        // ---- 12. Homepage Quiz ----
        (function initHomepageQuiz() {
            var quiz = document.getElementById('baderQuiz');
            if (!quiz) return;

            var steps = Array.prototype.slice.call(
                quiz.querySelectorAll('.bader-quiz__step')
            );
            if (!steps.length) return;

            var progressFill = quiz.querySelector('.bader-quiz__progress-fill');
            var progressText = quiz.querySelector('.bader-quiz__progress-text');
            var questionCounter = quiz.querySelector('.bader-quiz__counter');
            var backBtn = quiz.querySelector('.bader-quiz__back');
            var form = quiz.querySelector('.bader-quiz__form');
            var result = quiz.querySelector('.bader-quiz__result');
            var resetBtn = quiz.querySelector('.bader-quiz__reset');
            var completeBtn = quiz.querySelector('.bader-quiz__complete');

            var currentStep = 0;
            var answers = {};

            function updateProgress() {
                var total = steps.length;
                var pct = Math.round(((currentStep + 1) / total) * 100);

                if (progressFill) progressFill.style.width = pct + '%';
                if (progressText) progressText.textContent = pct + '% completado';
                if (questionCounter) {
                    questionCounter.textContent = 'Pregunta ' + (currentStep + 1) + ' de ' + total;
                }
                if (backBtn) backBtn.style.display = currentStep > 0 ? 'inline-flex' : 'none';
            }

            function showStep(stepIndex) {
                currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
                steps.forEach(function (stepEl, index) {
                    stepEl.classList.toggle('is-active', index === currentStep);
                });
                updateProgress();
            }

            function finishQuiz() {
                if (form) form.setAttribute('hidden', 'hidden');
                if (result) result.removeAttribute('hidden');
            }

            steps.forEach(function (stepEl, stepIndex) {
                var optionButtons = stepEl.querySelectorAll('.bader-quiz__option');
                optionButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        optionButtons.forEach(function (other) {
                            other.classList.remove('is-selected');
                        });
                        button.classList.add('is-selected');

                        var key = stepEl.getAttribute('data-key') || ('step_' + stepIndex);
                        answers[key] = button.getAttribute('data-value') || '';

                        setTimeout(function () {
                            if (stepIndex < steps.length - 1) {
                                showStep(stepIndex + 1);
                            } else {
                                finishQuiz();
                            }
                        }, 220);
                    });
                });
            });

            if (backBtn) {
                backBtn.addEventListener('click', function () {
                    showStep(currentStep - 1);
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', function () {
                    answers = {};
                    steps.forEach(function (stepEl) {
                        stepEl.querySelectorAll('.bader-quiz__option').forEach(function (option) {
                            option.classList.remove('is-selected');
                        });
                    });
                    if (result) result.setAttribute('hidden', 'hidden');
                    if (form) form.removeAttribute('hidden');
                    showStep(0);
                });
            }

            if (completeBtn) {
                completeBtn.addEventListener('click', function () {
                    var contactSection = document.getElementById('contacto');
                    if (contactSection) {
                        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            showStep(0);
        })();

        // ---- 13. Homepage Chat Widget ----
        (function initHomepageChatWidget() {
            var widget = document.getElementById('baderChatWidget');
            if (!widget) return;

            var bubble = document.getElementById('baderChatBubble');
            var bubbleClose = document.getElementById('baderChatBubbleClose');
            var toggleBtn = document.getElementById('baderChatToggle');
            var panel = document.getElementById('baderChatPanel');
            var minimizeBtn = document.getElementById('baderChatMinimize');
            var closeBtn = document.getElementById('baderChatClose');
            var messages = document.getElementById('baderChatMessages');
            var form = document.getElementById('baderChatForm');
            var input = document.getElementById('baderChatInput');

            if (!toggleBtn || !panel || !messages || !form || !input) return;

            function appendMessage(text, role) {
                var msg = document.createElement('div');
                msg.className = 'bader-chat__msg bader-chat__msg--' + role;
                msg.textContent = text;
                messages.appendChild(msg);
                messages.scrollTop = messages.scrollHeight;
            }

            function buildReply(userText) {
                var text = (userText || '').toLowerCase();
                if (text.indexOf('precio') !== -1 || text.indexOf('costo') !== -1 || text.indexOf('cuota') !== -1) {
                    return 'Trabajamos con financiacion hasta 12 cuotas sin interes. Si queres, te guiamos al producto ideal segun tu presupuesto.';
                }
                if (text.indexOf('sillon') !== -1 || text.indexOf('autoclave') !== -1 || text.indexOf('rayos') !== -1) {
                    return 'Perfecto. En /productos podes filtrar por categoria y nicho para encontrar los equipos que mejor encajan en tu practica.';
                }
                if (text.indexOf('garantia') !== -1 || text.indexOf('servicio') !== -1 || text.indexOf('soporte') !== -1) {
                    return 'Todos los equipos cuentan con garantia oficial y soporte tecnico. Tambien podes solicitar asistencia en /servicios.';
                }
                return 'Puedo ayudarte a elegir productos, precios, financiacion y soporte. Si preferis atencion inmediata, escribinos por WhatsApp.';
            }

            var hasWelcomed = false;
            function ensureWelcome() {
                if (hasWelcomed) return;
                appendMessage('Hola! Soy Nancy AI, tu asistente virtual de Bader Argentina.', 'assistant');
                appendMessage('Fui creada para ayudarte a encontrar el equipo ideal. Que producto estas buscando?', 'assistant');
                hasWelcomed = true;
            }

            function openPanel() {
                panel.removeAttribute('hidden');
                toggleBtn.style.display = 'none';
                if (bubble) bubble.style.display = 'none';
                ensureWelcome();
                input.focus();
            }

            function closePanel() {
                panel.setAttribute('hidden', 'hidden');
                toggleBtn.style.display = '';
            }

            if (bubbleClose && bubble) {
                bubbleClose.addEventListener('click', function () {
                    bubble.style.display = 'none';
                });
            }

            toggleBtn.addEventListener('click', openPanel);
            if (minimizeBtn) minimizeBtn.addEventListener('click', closePanel);
            if (closeBtn) closeBtn.addEventListener('click', closePanel);

            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var userText = (input.value || '').trim();
                if (!userText) return;

                appendMessage(userText, 'user');
                input.value = '';

                setTimeout(function () {
                    appendMessage(buildReply(userText), 'assistant');
                }, 300);
            });
        })();
})();

