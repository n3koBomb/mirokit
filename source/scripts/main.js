/* eslint-disable no-undef */
/* The translation object and language switch live in language.js. */
      const scroller = document.querySelector(".site-main.scroller"),progress = document.getElementById("progress"),burger = document.querySelector(".burger"),mobileMenu = document.getElementById("mobileMenu"),backdrop = document.getElementById("mobileBackdrop"),closeBtn = document.querySelector(".close-menu"),modal = document.getElementById("signupModal"),toast = document.getElementById("toast");
      let currentTheme = "light";
      try {
         currentTheme = localStorage.getItem("mirokitTheme") === "dark" ? "dark" : "light";
      } catch {
         // Theme still works for the current page when storage is blocked.
      }
      const panels = [...document.querySelectorAll(".panel")];
      const scrollTopControl = document.getElementById("scrollTopControl");
      const revealElements = [...document.querySelectorAll(".fu")];
      const themeToggles = [...document.querySelectorAll("[data-theme-toggle]")];
      const newsRotator = document.querySelector("[data-news-rotator]");
      const newsSlides = newsRotator ? [...newsRotator.querySelectorAll("[data-news-slide]")] : [];
      const newsDots = [...document.querySelectorAll("[data-news-rotate-target]")];
      const newsCurrent = document.querySelector("[data-news-current]");
      let newsSlideIndex = 0;
      let newsRotationTimer = 0;
      let revealFrame = 0;
      let revealObserver = null;

      function syncThemeControls() {
         const isDark = currentTheme === "dark";
         document.body.classList.toggle("theme-dark", isDark);
         document.documentElement.dataset.theme = currentTheme;
         const labelKey = isDark ? "theme_light" : "theme_dark";
         const label = T[currentLang]?.[labelKey] || (isDark ? "Light theme" : "Dark theme");
         themeToggles.forEach((toggle) => {
            toggle.setAttribute("aria-pressed", String(isDark));
            toggle.setAttribute("aria-label", label);
            toggle.setAttribute("title", label);
            const text = toggle.querySelector(".theme-toggle-label");
            if (text) text.textContent = label;
            const icon = toggle.querySelector("i");
            if (icon) {
               icon.classList.toggle("fa-moon", !isDark);
               icon.classList.toggle("fa-sun", isDark);
            }
         });
      }

      function setTheme(theme) {
         currentTheme = theme === "dark" ? "dark" : "light";
         try {
            localStorage.setItem("mirokitTheme", currentTheme);
         } catch {
            // Theme still applies for the current page when storage is blocked.
         }
         syncThemeControls();
      }

      function stopNewsRotation() {
         window.clearTimeout(newsRotationTimer);
         newsRotationTimer = 0;
      }

      function scheduleNewsRotation() {
         stopNewsRotation();
         if (newsSlides.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
         newsRotationTimer = window.setTimeout(() => showNewsSlide(newsSlideIndex + 1), 6500);
      }

      function showNewsSlide(index) {
         if (!newsSlides.length) return;
         newsSlideIndex = (index + newsSlides.length) % newsSlides.length;
         newsSlides.forEach((slide, slideIndex) => {
            const isActive = slideIndex === newsSlideIndex;
            slide.hidden = !isActive;
            slide.classList.toggle("is-active", isActive);
         });
         newsDots.forEach((dot) => {
            const isActive = Number(dot.dataset.newsRotateTarget) === newsSlideIndex;
            dot.classList.toggle("is-active", isActive);
            dot.setAttribute("aria-current", String(isActive));
         });
         if (newsCurrent) newsCurrent.textContent = String(newsSlideIndex + 1).padStart(2, "0");
         scheduleNewsRotation();
      }

      themeToggles.forEach((toggle) => toggle.addEventListener("click", () => setTheme(currentTheme === "dark" ? "light" : "dark")));
      newsDots.forEach((dot) => dot.addEventListener("click", () => showNewsSlide(Number(dot.dataset.newsRotateTarget))));
      newsRotator?.addEventListener("mouseenter", stopNewsRotation);
      newsRotator?.addEventListener("mouseleave", scheduleNewsRotation);
      newsRotator?.addEventListener("focusin", stopNewsRotation);
      newsRotator?.addEventListener("focusout", (event) => {
         if (!newsRotator.contains(event.relatedTarget)) scheduleNewsRotation();
      });
      syncThemeControls();
      showNewsSlide(0);

      function revealVisibleElements() {
         revealFrame = 0;
         const revealLine = window.innerHeight * 0.82;
         revealElements.forEach((element) => {
            if (element.classList.contains("vis")) return;
            const bounds = element.getBoundingClientRect();
            if (bounds.top <= revealLine && bounds.bottom > 0) element.classList.add("vis");
         });
      }

      function scheduleReveal() {
         if (!revealFrame) revealFrame = requestAnimationFrame(revealVisibleElements);
      }

      function syncReadingProgress() {
         const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
         const progress = scrollableHeight ? Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1) : 0;
         const percent = Math.round(progress * 100);
         document.documentElement.style.setProperty("--scroll-progress-value", percent);
         document.documentElement.style.setProperty("--scroll-progress", `${percent}%`);
         document.documentElement.style.setProperty("--scroll-progress-offset", 100 - percent);
         document.documentElement.style.setProperty("--scroll-progress-angle", `${percent * 3.6}deg`);
         document.documentElement.style.setProperty("--scroll-glow-opacity", String(0.18 + progress * 0.38));
         if (scrollTopControl) {
            const percentNode = scrollTopControl.querySelector(".scroll-top-percent");
            if (percentNode) percentNode.textContent = `${percent}%`;
            scrollTopControl.classList.toggle("is-visible", window.scrollY > Math.min(180, window.innerHeight * 0.18) || percent > 1);
            scrollTopControl.classList.toggle("is-complete", percent >= 99);
         }
      }

      function syncFooterTaskbar() {
         if (!panels.length) return;

         const active = panels.reduce((best, panel) => {
            const currentDistance = Math.abs(panel.getBoundingClientRect().top);
            const bestDistance = Math.abs(best.getBoundingClientRect().top);
            return currentDistance < bestDistance ? panel : best;
         }, panels[0]);

         document.body.classList.toggle("is-home", active?.id === "hero");
         syncReadingProgress();
      }

      function initIntroLoader() {
         const introLoader = document.getElementById("introLoader");
         const introLogo = introLoader?.querySelector(".intro-loader-logo");
         const headerLogo = document.querySelector(".topbar .logo-placeholder");
         const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

         if (!introLoader || !introLogo || !headerLogo || reducedMotion) {
            document.body.classList.remove("intro-loading");
            introLoader?.remove();
            return;
         }

         let started = false;

         async function inlineIntroSvg() {
            const svgSource = introLogo.dataset.svgSrc;
            if (!svgSource) return false;

            try {
               const response = await fetch(svgSource, { cache: "force-cache" });
               if (!response.ok) throw new Error(`SVG request failed: ${response.status}`);

               const svgDocument = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
               const svg = svgDocument.documentElement;
               if (svg.nodeName.toLowerCase() !== "svg" || svg.querySelector("parsererror")) throw new Error("Invalid intro SVG");

               svg.removeAttribute("width");
               svg.removeAttribute("height");
               svg.setAttribute("viewBox", "0 0 344 338");
               svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
               svg.setAttribute("aria-hidden", "true");
               svg.classList.add("intro-logo-svg");

               const pieces = [...svg.querySelectorAll("path")];
               pieces.forEach((path, index) => {
                  const piece = document.createElementNS("http://www.w3.org/2000/svg", "g");
                  piece.classList.add("intro-logo-piece");
                  piece.style.setProperty("--piece-angle", `${index % 2 ? 5 : -5}deg`);
                  piece.style.setProperty("--piece-mid-angle", `${index % 2 ? -1.75 : 1.75}deg`);
                  piece.style.setProperty("--piece-delay", `${(0.52 + index * 0.1).toFixed(2)}s`);
                  path.replaceWith(piece);
                  piece.append(path);
               });

               introLogo.replaceChildren(document.importNode(svg, true));
               introLogo.classList.add("is-svg-ready");
               return true;
            } catch (error) {
               console.warn("MIRoKIT intro SVG could not be inlined.", error);
               const fallback = document.createElement("img");
               fallback.src = introLogo.dataset.svg-src;
               fallback.alt = "SVG-LOGOofMIRoKIT";
               fallback.setAttribute("aria-hidden", "true");
               fallback.className = "intro-logo-fallback";
               introLogo.replaceChildren(fallback);
               return false;
            }
         }

         const finishIntro = () => {
            if (introLoader.dataset.finished) return;
            introLoader.dataset.finished = "true";
            document.body.classList.remove("intro-loading");
            introLoader.classList.add("is-finished");
            window.setTimeout(() => introLoader.remove(), 750);
         };

         const moveLogoToHeader = () => {
            if (!started || introLoader.dataset.moving) return;
            introLoader.dataset.moving = "true";
            introLoader.classList.add("is-moving");

            const introRect = introLogo.getBoundingClientRect();
            const headerRect = headerLogo.getBoundingClientRect();
            const targetSize = Math.max(24, Math.min(headerRect.height * 0.5, introRect.width));
            const targetLeft = headerRect.left + headerRect.width * 0.075;
            const targetTop = headerRect.top + headerRect.height * 0.245;
            const translateX = targetLeft + targetSize / 2 - (introRect.left + introRect.width / 2);
            const translateY = targetTop + targetSize / 2 - (introRect.top + introRect.height / 2);
            const scale = targetSize / introRect.width;

            if (typeof introLogo.animate !== "function") {
               finishIntro();
               return;
            }

            const movement = introLogo.animate(
               [
                  { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
                  { transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(0deg) scale(${scale})` },
               ],
               {
                  duration: 1450,
                  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                  fill: "forwards",
               },
            );
            movement.onfinish = finishIntro;
            window.setTimeout(finishIntro, 1750);
         };

         const startIntro = () => {
            if (started) return;
            started = true;
            introLoader.classList.add("is-started");
            window.setTimeout(moveLogoToHeader, 3650);
         };

         inlineIntroSvg().then(startIntro).catch(startIntro);
      }

      initIntroLoader();
      const contactViews = [...document.querySelectorAll("[data-contact-view]")];

      function setContactView(viewKey = "main-contact") {
         const selectedKey = contactViews.some((view) => view.dataset.contactView === viewKey) ? viewKey : "main-contact";

         contactViews.forEach((view) => {
            view.hidden = view.dataset.contactView !== selectedKey;
         });
         const activeContactView = contactViews.find((view) => view.dataset.contactView === selectedKey);
         const contactQuicklinks = activeContactView?.querySelector(".contact-quicklinks");
         if (contactQuicklinks && revealObserver) {
            revealObserver.unobserve(contactQuicklinks);
            revealObserver.observe(contactQuicklinks);
         }
         scheduleReveal();
         document.querySelectorAll('[href="#contact"][data-link-key]').forEach((link) => {
            const isCurrent = link.dataset.linkKey === selectedKey;
            link.classList.toggle("is-current", isCurrent);
            if (isCurrent) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
         });

      }

      setContactView();

      const galleryViews = [...document.querySelectorAll("[data-gallery-view]")];

      function setGalleryView(viewKey = "gallery-main") {
         const selectedKey = galleryViews.some((view) => view.dataset.galleryView === viewKey) ? viewKey : "gallery-main";

         galleryViews.forEach((view) => {
            view.hidden = view.dataset.galleryView !== selectedKey;
         });
         scheduleReveal();
         document.querySelectorAll("[data-gallery-link]").forEach((link) => {
            const isCurrent = link.dataset.linkKey === selectedKey;
            link.classList.toggle("is-current", isCurrent);
            if (isCurrent) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
         });

      }

      setGalleryView();

      const projectsPanel = document.getElementById("projects");
      const projectsViews = [...document.querySelectorAll("[data-projects-view]")];
      const projectsLogo = projectsPanel?.querySelector(".section-logo img");
      const projectsLogoByView = {
         current_projects: "public/assets/logos/sections/current_projects_page.png",
         pas_projects: "public/assets/logos/sections/past_projects_page.png",
      };

      function setProjectsView(viewKey = "current_projects") {
         const selectedKey = projectsViews.some((view) => view.dataset.projectsView === viewKey) ? viewKey : "current_projects";

         projectsViews.forEach((view) => {
            view.hidden = view.dataset.projectsView !== selectedKey;
         });
         scheduleReveal();
         document.querySelectorAll("[data-projects-link]").forEach((link) => {
            const isCurrent = link.dataset.linkKey === selectedKey;
            link.classList.toggle("is-current", isCurrent);
            link.classList.toggle("is-active", isCurrent);
            if (link.getAttribute("role") === "tab") {
               link.setAttribute("aria-selected", String(isCurrent));
               link.removeAttribute("aria-current");
            } else if (isCurrent) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
         });

         if (projectsLogo) {
            projectsLogo.src = projectsLogoByView[selectedKey] || projectsLogoByView.current_projects;
            projectsLogo.alt = selectedKey === "pas_projects" ? "Logo vergangene Projekte MIRoKIT" : "Logo aktuelle Projekte MIRoKIT";
         }
      }

      setProjectsView();

      document.querySelectorAll("button[data-projects-link]").forEach((button) =>
         button.addEventListener("click", () => setProjectsView(button.dataset.linkKey || "current_projects")),
      );

      function getHashTarget(hash) {
         if (!hash || !hash.startsWith("#")) return null;
         try {
            return document.querySelector(hash);
         } catch {
            return null;
         }
      }

      function goToHash(hash) {
         const target = getHashTarget(hash);
         if (!target) return;

         target.scrollIntoView({
            behavior: "smooth",
            block: "start",
         });

         history.replaceState(null, "", hash);
      }
      document.querySelectorAll("[data-nav-link]").forEach((a) =>
         a.addEventListener("click", (e) => {
            const href = a.getAttribute("href");
            if (href && href.startsWith("#")) {
               e.preventDefault();
               if (href === "#contact" && a.dataset.linkKey) setContactView(a.dataset.linkKey);
               if (href === "#gallery") setGalleryView(a.dataset.linkKey || "gallery-main");
               if (href === "#projects") setProjectsView(a.dataset.linkKey || "current_projects");
               goToHash(href);
               closeDesktopMenus();
               closeMenu();
            }
         }),
      );

      if (scrollTopControl) {
         const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
         let launchTimer = 0;

         scrollTopControl.addEventListener("click", () => {
            window.clearTimeout(launchTimer);
            scrollTopControl.classList.remove("is-launching");
            void scrollTopControl.offsetWidth;
            scrollTopControl.classList.add("is-launching");

            const behavior = reducedMotion?.matches ? "auto" : "smooth";
            document.getElementById("hero")?.scrollIntoView({ behavior, block: "start" });
            if (location.hash !== "#hero") history.replaceState(null, "", "#hero");

            launchTimer = window.setTimeout(() => scrollTopControl.classList.remove("is-launching"), 780);
         });
      }

      window.addEventListener("scroll", syncFooterTaskbar, { passive: true });
      window.addEventListener("resize", syncReadingProgress, { passive: true });
      requestAnimationFrame(syncFooterTaskbar);

      window.addEventListener("keydown", (e) => {
         if (document.querySelector(".gallery-media-modal.show, .news-modal.show")) return;

         if (e.key === "Escape") {
            closeMenu();
            closeModal();
         }
      });
      function openMenu() {
         mobileMenu.classList.add("show");
         backdrop.classList.add("show");
         burger.setAttribute("aria-expanded", "true");
         mobileMenu.setAttribute("aria-hidden", "false");
         document.body.classList.add("menu-open");
      }
      function closeMenu() {
         mobileMenu.classList.remove("show");
         backdrop.classList.remove("show");
         burger.setAttribute("aria-expanded", "false");
         mobileMenu.setAttribute("aria-hidden", "true");
         document.body.classList.remove("menu-open");
         document.querySelectorAll(".mobile-sub-toggle").forEach((button) => {
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("is-open");
         });
         document.querySelectorAll(".mobile-sub").forEach((submenu) => submenu.classList.remove("open"));
      }
      burger.addEventListener("click", () => (burger.getAttribute("aria-expanded") === "true" ? closeMenu() : openMenu()));
      backdrop.addEventListener("click", closeMenu);
      closeBtn.addEventListener("click", closeMenu);
      document.querySelectorAll(".mobile-sub-toggle").forEach((btn) =>
         btn.addEventListener("click", () => {
            const submenu = btn.nextElementSibling;
            const isOpen = submenu?.classList.toggle("open") ?? false;
            btn.classList.toggle("is-open", isOpen);
            btn.setAttribute("aria-expanded", String(isOpen));
            submenu?.setAttribute("aria-hidden", String(!isOpen));
         }),
      );

      const desktopNav = document.querySelector(".desktop-nav");

      function closeDesktopMenus() {
         desktopNav?.querySelectorAll(".nav-item.is-open, .submenu-item.is-open").forEach((item) => item.classList.remove("is-open"));
         desktopNav?.querySelectorAll(".submenu-toggle[aria-expanded=\"true\"]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      }

      desktopNav?.querySelectorAll(".submenu-toggle").forEach((button) => {
         button.addEventListener("click", (event) => {
            event.stopPropagation();
            const item = button.closest(".nav-item, .submenu-item");
            const isOpen = item?.classList.toggle("is-open") ?? false;
            button.setAttribute("aria-expanded", String(isOpen));
            if (isOpen) {
               desktopNav.querySelectorAll(".nav-item.is-open, .submenu-item.is-open").forEach((other) => {
                  if (other !== item && !item?.contains(other) && !other.contains(item)) other.classList.remove("is-open");
               });
            }
         });
         button.addEventListener("focus", () => {
            const item = button.closest(".nav-item, .submenu-item");
            item?.classList.add("is-open");
            button.setAttribute("aria-expanded", "true");
         });
      });

      desktopNav?.addEventListener("pointerleave", closeDesktopMenus);
      document.addEventListener("pointerdown", (event) => {
         if (desktopNav && !desktopNav.contains(event.target)) closeDesktopMenus();
      });
      revealObserver = new IntersectionObserver(
         (es) =>
            es.forEach((e) => {
               if (e.isIntersecting) e.target.classList.add("vis");
            }),
         { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
      );
      revealElements.forEach((el) => revealObserver.observe(el));
      window.addEventListener("scroll", scheduleReveal, { passive: true });
      scheduleReveal();
      function openModal() {
         modal.classList.add("show");
         modal.setAttribute("aria-hidden", "false");
         document.body.classList.add("menu-open");
         modal.querySelector("input")?.focus();
      }
      function closeModal() {
         modal.classList.remove("show");
         modal.setAttribute("aria-hidden", "true");
         document.body.classList.remove("menu-open");
      }
      document.querySelectorAll("[data-open-modal]").forEach((b) => b.addEventListener("click", openModal));
      document.querySelector(".modal-close").addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => {
         if (e.target === modal) closeModal();
      });
      function showToast(msg) {
         toast.textContent = msg;
         toast.classList.add("show");
         setTimeout(() => toast.classList.remove("show"), 2600);
      }
      document.getElementById("signupForm").addEventListener("submit", (e) => {
         e.preventDefault();
         const fd = new FormData(e.currentTarget);
         const subject = encodeURIComponent(T[currentLang].mail_subject);
         const body = encodeURIComponent(`${T[currentLang].mail_name}: ${fd.get("name")}\n${T[currentLang].mail_email}: ${fd.get("email")}\n\n${T[currentLang].mail_message}:\n${fd.get("message")}`);
         showToast(T[currentLang].toast_sent);
         closeModal();
         location.href = `mailto:info@mirokit.org?subject=${subject}&body=${body}`;
      });

      // --- #gallery: zugängliche Foto-Lightbox und Video-Modal ---
      const galleryImageModal = document.getElementById("galleryImageModal");
      const galleryVideoModal = document.getElementById("galleryVideoModal");
      const galleryImageButtons = [...document.querySelectorAll("[data-gallery-image]")];
      const galleryImageModalImg = galleryImageModal.querySelector(".gallery-image-stage img");
      const galleryImageCaption = galleryImageModal.querySelector(".gallery-image-caption");
      const galleryVideo = galleryVideoModal.querySelector(".gallery-modal-video");
      const galleryVideoTitle = document.getElementById("galleryVideoModalTitle");
      const galleryVideoNote = document.getElementById("galleryVideoModalNote");
      let galleryImageIndex = 0;
      let galleryModalTrigger = null;

      function galleryFocusable(modalEl) {
         return [...modalEl.querySelectorAll('button, [href], video[controls], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
      }

      function renderGalleryImage(index) {
         if (!galleryImageButtons.length) return;
         galleryImageIndex = (index + galleryImageButtons.length) % galleryImageButtons.length;
         const trigger = galleryImageButtons[galleryImageIndex];
         const image = trigger.querySelector("img");
         galleryImageModalImg.src = image.currentSrc || image.src;
         galleryImageModalImg.alt = image.alt;
         galleryImageCaption.textContent = `${galleryImageIndex + 1} / ${galleryImageButtons.length} — ${trigger.dataset.galleryTitle}`;
      }

      function openGalleryImageModal(trigger) {
         galleryModalTrigger = trigger;
         renderGalleryImage(galleryImageButtons.indexOf(trigger));
         galleryImageModal.classList.add("show");
         galleryImageModal.setAttribute("aria-hidden", "false");
         document.body.classList.add("menu-open");
         galleryImageModal.querySelector(".gallery-modal-close").focus();
      }

      function closeGalleryImageModal() {
         galleryImageModal.classList.remove("show");
         galleryImageModal.setAttribute("aria-hidden", "true");
         document.body.classList.remove("menu-open");
         galleryModalTrigger?.focus();
      }

      function openGalleryVideoModal(trigger) {
         galleryModalTrigger = trigger;
         const poster = trigger.querySelector("img")?.currentSrc || trigger.closest(".video-card")?.querySelector("img")?.currentSrc || "";
         const source = trigger.dataset.videoSrc;
         galleryVideo.poster = poster;
         galleryVideoTitle.textContent = trigger.dataset.videoTitle || T[currentLang].gallery_video_modal;
         galleryVideoNote.hidden = Boolean(source);
         galleryVideo.removeAttribute("src");
         if (source) galleryVideo.src = source;
         galleryVideo.load();
         galleryVideoModal.classList.add("show");
         galleryVideoModal.setAttribute("aria-hidden", "false");
         document.body.classList.add("menu-open");
         galleryVideo.focus();
      }

      function closeGalleryVideoModal() {
         galleryVideo.pause();
         galleryVideo.removeAttribute("src");
         galleryVideo.load();
         galleryVideoModal.classList.remove("show");
         galleryVideoModal.setAttribute("aria-hidden", "true");
         document.body.classList.remove("menu-open");
         galleryModalTrigger?.focus();
      }

      galleryImageButtons.forEach((button) => button.addEventListener("click", () => openGalleryImageModal(button)));
      document.querySelectorAll("[data-gallery-video]").forEach((button) => button.addEventListener("click", () => openGalleryVideoModal(button)));
      galleryImageModal.querySelector(".gallery-modal-close").addEventListener("click", closeGalleryImageModal);
      galleryImageModal.querySelector(".gallery-modal-prev").addEventListener("click", () => renderGalleryImage(galleryImageIndex - 1));
      galleryImageModal.querySelector(".gallery-modal-next").addEventListener("click", () => renderGalleryImage(galleryImageIndex + 1));
      galleryVideoModal.querySelector(".gallery-modal-close").addEventListener("click", closeGalleryVideoModal);
      galleryImageModal.addEventListener("click", (e) => {
         if (e.target === galleryImageModal) closeGalleryImageModal();
      });
      galleryVideoModal.addEventListener("click", (e) => {
         if (e.target === galleryVideoModal) closeGalleryVideoModal();
      });
      document.addEventListener("keydown", (e) => {
         const activeModal = galleryImageModal.classList.contains("show") ? galleryImageModal : galleryVideoModal.classList.contains("show") ? galleryVideoModal : null;
         if (!activeModal) return;
         if (e.key === "Escape") {
            e.preventDefault();
            activeModal === galleryImageModal ? closeGalleryImageModal() : closeGalleryVideoModal();
            return;
         }
         if (activeModal === galleryImageModal && e.key === "ArrowRight") {
            e.preventDefault();
            renderGalleryImage(galleryImageIndex + 1);
            return;
         }
         if (activeModal === galleryImageModal && e.key === "ArrowLeft") {
            e.preventDefault();
            renderGalleryImage(galleryImageIndex - 1);
            return;
         }
         if (e.key === "Tab") {
            const focusables = galleryFocusable(activeModal);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
               e.preventDefault();
               last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
               e.preventDefault();
               first.focus();
            }
         }
      });

      // --- #news: Kategorie-Filter ---
      const newsFilterBtns = document.querySelectorAll(".news-filter-btn");
      const newsWraps = Array.from(document.querySelectorAll(".news-card-full-wrap"));
      const newsEmpty = document.getElementById("newsEmpty");
      newsFilterBtns.forEach((btn) =>
         btn.addEventListener("click", () => {
            newsFilterBtns.forEach((b) => {
               b.classList.remove("is-active");
               b.setAttribute("aria-pressed", "false");
            });
            btn.classList.add("is-active");
            btn.setAttribute("aria-pressed", "true");
            const f = btn.dataset.filter;
            let visibleCount = 0;
            newsWraps.forEach((w) => {
               const match = f === "all" || w.dataset.category === f;
               w.hidden = !match;
               if (match) visibleCount++;
            });
            newsEmpty.hidden = visibleCount > 0;
         }),
      );

      // --- #news: Modal mit Vor/Zurück-Navigation zwischen den Karten ---
      const newsModal = document.getElementById("newsModal");
      const newsModalCard = newsModal.querySelector(".news-modal-card");
      const newsModalImg = newsModal.querySelector(".news-modal-image img");
      const newsModalCategory = newsModal.querySelector(".news-modal-category");
      const newsModalDate = newsModal.querySelector(".news-modal-date");
      const newsModalTitle = document.getElementById("newsModalTitle");
      const newsModalBody = newsModal.querySelector(".news-modal-body-text");
      const newsModalCounter = newsModal.querySelector(".news-modal-counter");
      let newsIndex = 0;
      let newsOpenedFrom = null;

      function newsCardData(wrap) {
         const btn = wrap.querySelector(".news-card-full");
         const catEl = btn.querySelector(".category");
         return {
            img: btn.querySelector(".news-full-img-wrap img"),
            categoryText: catEl.textContent.trim(),
            categoryClass: [...catEl.classList].find((c) => c.startsWith("cat-")) || "",
            date: btn.querySelector(".news-full-date").innerHTML,
            title: btn.querySelector(".news-full-title").textContent.trim(),
            template: wrap.querySelector("template"),
         };
      }

      function renderNewsModal(index) {
         const visible = newsWraps.filter((w) => !w.hidden);
         if (!visible.length) return;
         newsIndex = (index + visible.length) % visible.length;
         const data = newsCardData(visible[newsIndex]);
         newsModalImg.src = data.img.src;
         newsModalImg.alt = data.img.alt;
         newsModalCategory.textContent = data.categoryText;
         newsModalCategory.className = "category news-modal-category " + data.categoryClass;
         newsModalDate.innerHTML = data.date;
         newsModalTitle.textContent = data.title;
         newsModalBody.innerHTML = "";
         if (data.template) newsModalBody.appendChild(data.template.content.cloneNode(true));
         newsModalCounter.textContent = `${newsIndex + 1} / ${visible.length}`;
      }

      function openNewsModal(startIndex) {
         newsOpenedFrom = document.activeElement;
         renderNewsModal(startIndex);
         newsModal.classList.add("show");
         newsModal.setAttribute("aria-hidden", "false");
         document.body.classList.add("menu-open");
         newsModal.querySelector(".news-modal-close").focus();
      }

      function closeNewsModal() {
         newsModal.classList.remove("show");
         newsModal.setAttribute("aria-hidden", "true");
         document.body.classList.remove("menu-open");
         newsOpenedFrom?.focus();
      }

      newsWraps.forEach((wrap) => {
         wrap.querySelector(".news-card-full").addEventListener("click", () => {
            const visible = newsWraps.filter((w) => !w.hidden);
            openNewsModal(visible.indexOf(wrap));
         });
      });
      newsModal.querySelector(".news-modal-close").addEventListener("click", closeNewsModal);
      newsModal.querySelector(".news-modal-prev").addEventListener("click", () => renderNewsModal(newsIndex - 1));
      newsModal.querySelector(".news-modal-next").addEventListener("click", () => renderNewsModal(newsIndex + 1));
      newsModal.addEventListener("click", (e) => {
         if (e.target === newsModal) closeNewsModal();
      });
      document.addEventListener("keydown", (e) => {
         if (!newsModal.classList.contains("show")) return;
         if (e.key === "Escape") {
            closeNewsModal();
            return;
         }
         if (e.key === "ArrowRight") {
            renderNewsModal(newsIndex + 1);
            return;
         }
         if (e.key === "ArrowLeft") {
            renderNewsModal(newsIndex - 1);
            return;
         }
         if (e.key === "Tab") {
            const focusables = newsModalCard.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!focusables.length) return;
            const first = focusables[0],
               last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
               e.preventDefault();
               last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
               e.preventDefault();
               first.focus();
            }
         }
      });

      scroller.addEventListener("scroll", () => {
         const max = scroller.scrollHeight - scroller.clientHeight;

         if (progress) {
            progress.style.width = (max ? (scroller.scrollTop / max) * 100 : 0) + "%";
         }
      });

      window.addEventListener("load", () => {
         if (getHashTarget(location.hash)) setTimeout(() => goToHash(location.hash), 80);
      });
