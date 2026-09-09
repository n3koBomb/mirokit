(() => {
   "use strict";

   const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
   const IS_LOCAL = LOCAL_HOSTNAMES.has(window.location.hostname);

   const LOCAL_WORKER_HOST =
      window.location.hostname === "127.0.0.1"
         ? "127.0.0.1"
         : "localhost";

   const CONTACT_ENDPOINT = IS_LOCAL
      ? `http://${LOCAL_WORKER_HOST}:8787/api/v1/contact`
      : "/api/v1/contact";

   // Official Cloudflare Turnstile always-pass test site key.
   // It is used only on localhost / 127.0.0.1.
   const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

   // Put the real production site key in the meta tag in index.html.
   const productionSiteKey =
      document
         .querySelector('meta[name="mirokit-turnstile-sitekey"]')
         ?.getAttribute("content")
         ?.trim() || "";

   const TURNSTILE_SITE_KEY = IS_LOCAL
      ? TURNSTILE_TEST_SITE_KEY
      : productionSiteKey;

   const TURNSTILE_PLACEHOLDERS = new Set([
      "",
      "PASTE_YOUR_PRODUCTION_SITE_KEY_HERE",
      "DEIN_TURNSTILE_SITE_KEY",
   ]);

   const FORM_CONFIGS = [
      {
         element: document.getElementById("contactForm"),
         type: "main-contact",
         turnstileContainerId: "contactTurnstile",
         action: "contact",
      },
      {
         element: document.getElementById("leagueForm"),
         type: "extra-contact",
         turnstileContainerId: "leagueTurnstile",
         action: "league",
      },
   ];

   const turnstileState = new Map();

   function showContactToast(message) {
      const toast = document.getElementById("toast");

      if (!toast) {
         console.info(message);
         return;
      }

      toast.textContent = message;
      toast.classList.add("show");

      window.clearTimeout(showContactToast.timer);
      showContactToast.timer = window.setTimeout(() => {
         toast.classList.remove("show");
      }, 3600);
   }

   function formDataToObject(form) {
      const result = {};
      const formData = new FormData(form);

      for (const [key, value] of formData.entries()) {
         if (Object.prototype.hasOwnProperty.call(result, key)) {
            if (!Array.isArray(result[key])) {
               result[key] = [result[key]];
            }
            result[key].push(value);
         } else {
            result[key] = value;
         }
      }

      return result;
   }

   function getSubmitButton(form) {
      return form?.querySelector('button[type="submit"]') || null;
   }

   function setSubmitting(button, submitting) {
      if (!button) return;

      if (submitting) {
         button.dataset.originalHtml = button.innerHTML;
         button.disabled = true;
         button.setAttribute("aria-busy", "true");
         button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span>Wird gesendet…</span>
         `;
      } else {
         button.removeAttribute("aria-busy");

         if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
         }
      }
   }

   function setSecurityReady(config, ready) {
      const button = getSubmitButton(config.element);
      const state = turnstileState.get(config.type);

      if (state) state.ready = ready;

      if (!button || button.getAttribute("aria-busy") === "true") {
         return;
      }

      button.disabled = !ready;
      button.setAttribute("aria-disabled", String(!ready));
   }

   function waitForTurnstile(timeoutMs = 15000) {
      return new Promise((resolve, reject) => {
         const started = Date.now();

         const check = () => {
            if (window.turnstile?.render) {
               resolve(window.turnstile);
               return;
            }

            if (Date.now() - started >= timeoutMs) {
               reject(new Error("Cloudflare Turnstile konnte nicht geladen werden."));
               return;
            }

            window.setTimeout(check, 100);
         };

         check();
      });
   }

   let turnstileScriptPromise = null;

   function loadTurnstileScript() {
      if (window.turnstile?.render) return Promise.resolve(window.turnstile);
      if (turnstileScriptPromise) return turnstileScriptPromise;

      turnstileScriptPromise = new Promise((resolve, reject) => {
         const script = document.createElement("script");
         script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
         script.async = true;
         script.onload = () => waitForTurnstile().then(resolve, reject);
         script.onerror = () => reject(new Error("Cloudflare Turnstile konnte nicht geladen werden."));
         document.head.append(script);
      });

      return turnstileScriptPromise;
   }

   function resetTurnstile(config) {
      const state = turnstileState.get(config.type);
      if (!state) return;

      state.token = "";
      state.ready = false;
      setSecurityReady(config, false);

      if (window.turnstile && state.widgetId !== null) {
         try {
            window.turnstile.reset(state.widgetId);
         } catch (error) {
            console.warn("[MIRoKIT] Turnstile reset failed:", error);
         }
      }
   }

   function validateLeagueGroups(form) {
      if (form.id !== "leagueForm") return true;

      const groups = [
         {
            name: "activities",
            message: "Bitte mindestens einen Tätigkeitsbereich auswählen.",
         },
         {
            name: "goals",
            message: "Bitte mindestens ein Ziel für den Liga-Beitritt auswählen.",
         },
      ];

      for (const group of groups) {
         const inputs = [...form.querySelectorAll(`input[name="${group.name}"]`)];
         if (!inputs.length) continue;

         const valid = inputs.some((input) => input.checked);
         inputs.forEach((input) => input.setCustomValidity(""));

         if (!valid) {
            inputs[0].setCustomValidity(group.message);
            inputs[0].reportValidity();
            return false;
         }
      }

      return true;
   }

   function bindLeagueGroupValidation(form) {
      if (form.id !== "leagueForm") return;

      for (const name of ["activities", "goals"]) {
         const inputs = [...form.querySelectorAll(`input[name="${name}"]`)];
         inputs.forEach((input) => {
            input.addEventListener("change", () => {
               if (inputs.some((item) => item.checked)) {
                  inputs.forEach((item) => item.setCustomValidity(""));
               }
            });
         });
      }
   }

   function getTurnstileToken(config) {
      const state = turnstileState.get(config.type);
      if (!state) return "";

      if (state.token) return state.token;

      if (window.turnstile && state.widgetId !== null) {
         try {
            return window.turnstile.getResponse(state.widgetId) || "";
         } catch {
            // Fall through to the hidden input as a final fallback.
         }
      }

      return (
         config.element
            ?.querySelector('input[name="cf-turnstile-response"]')
            ?.value || ""
      );
   }

   async function submitContactForm(config) {
      const { element: form, type: formType } = config;
      const fields = formDataToObject(form);
      const turnstileToken = getTurnstileToken(config);

      // Never include the automatic Turnstile field twice in the payload.
      delete fields["cf-turnstile-response"];

      if (!turnstileToken) {
         throw new Error("Die Sicherheitsprüfung ist noch nicht bereit.");
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      try {
         const response = await fetch(CONTACT_ENDPOINT, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               Accept: "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
               formType,
               fields,
               turnstileToken,
               meta: {
                  language: document.documentElement.lang || "ru",
                  page: window.location.href,
                  submittedAt: new Date().toISOString(),
               },
            }),
         });

         let result = {};
         try {
            result = await response.json();
         } catch {
            // Keep a generic error below if the server returned non-JSON.
         }

         if (!response.ok) {
            throw new Error(
               result.message || `Server returned ${response.status}`
            );
         }

         return result;
      } catch (error) {
         if (error?.name === "AbortError") {
            throw new Error("Der Server hat zu lange gebraucht. Bitte erneut versuchen.");
         }
         throw error;
      } finally {
         window.clearTimeout(timeoutId);
      }
   }

   function bindForm(config) {
      const form = config.element;
      if (!form) return;

      const state = {
         widgetId: null,
         token: "",
         ready: false,
         ignoreNextResetEvent: false,
      };
      turnstileState.set(config.type, state);

      bindLeagueGroupValidation(form);
      setSecurityReady(config, false);

      form.addEventListener("reset", () => {
         if (state.ignoreNextResetEvent) {
            state.ignoreNextResetEvent = false;
            return;
         }

         window.setTimeout(() => resetTurnstile(config), 0);
      });

      form.addEventListener("submit", async (event) => {
         event.preventDefault();

         if (!form.reportValidity() || !validateLeagueGroups(form)) {
            return;
         }

         const turnstileToken = getTurnstileToken(config);
         if (!turnstileToken) {
            showContactToast(
               "Bitte warte kurz, bis die Sicherheitsprüfung abgeschlossen ist."
            );
            return;
         }

         const submitButton = getSubmitButton(form);
         setSubmitting(submitButton, true);

         try {
            const result = await submitContactForm(config);

            state.ignoreNextResetEvent = true;
            form.reset();

            showContactToast(
               config.type === "extra-contact"
                  ? "Die MIRoKIT-Liga-Anfrage wurde gesendet."
                  : "Deine Nachricht wurde gesendet."
            );

            if (IS_LOCAL && result?.mode === "local-preview") {
               console.info(
                  "[MIRoKIT] Local test completed. No real email was sent."
               );
            }
         } catch (error) {
            console.error("MIRoKIT contact form error:", error);
            showContactToast(
               error?.message ||
                  "Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut."
            );
         } finally {
            setSubmitting(submitButton, false);
            resetTurnstile(config);
         }
      });
   }

   async function initTurnstile() {
      if (!IS_LOCAL && TURNSTILE_PLACEHOLDERS.has(TURNSTILE_SITE_KEY)) {
         throw new Error(
            "Production Turnstile Site Key fehlt. Setze ihn im meta-Tag mirokit-turnstile-sitekey."
         );
      }

      const turnstile = await loadTurnstileScript();

      for (const config of FORM_CONFIGS) {
         const form = config.element;
         const container = document.getElementById(config.turnstileContainerId);
         const state = turnstileState.get(config.type);

         if (!form || !container || !state) continue;

         state.widgetId = turnstile.render(container, {
            sitekey: TURNSTILE_SITE_KEY,
            action: config.action,
            theme: "auto",
            callback: (token) => {
               state.token = token;
               setSecurityReady(config, true);
            },
            "error-callback": (errorCode) => {
               state.token = "";
               setSecurityReady(config, false);
               console.error("[MIRoKIT Turnstile] Error:", errorCode);
               showContactToast(
                  "Die Sicherheitsprüfung konnte nicht geladen werden."
               );
            },
            "expired-callback": () => {
               state.token = "";
               setSecurityReady(config, false);
            },
            "timeout-callback": () => {
               state.token = "";
               setSecurityReady(config, false);
            },
         });
      }
   }

   FORM_CONFIGS.forEach(bindForm);

   function scheduleTurnstileInitialization() {
      const contactSection = document.getElementById("contact");
      if (!contactSection) return;

      let started = false;
      const start = () => {
         if (started) return;
         started = true;
         initTurnstile().catch((error) => {
            console.error("[MIRoKIT] Turnstile initialization failed:", error);
            FORM_CONFIGS.forEach((config) => setSecurityReady(config, false));
            showContactToast("Die Sicherheitsprüfung konnte nicht initialisiert werden.");
         });
      };

      contactSection.addEventListener("focusin", start, { once: true });
      contactSection.addEventListener("pointerdown", start, { once: true });

      if (!("IntersectionObserver" in window)) {
         window.addEventListener("load", () => window.setTimeout(start, 1200), { once: true });
         return;
      }

      const observer = new IntersectionObserver(
         (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            start();
         },
         { rootMargin: "700px 0px", threshold: 0.01 },
      );
      observer.observe(contactSection);
   }

   scheduleTurnstileInitialization();
})();
