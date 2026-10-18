
/**
 * MIRoKIT contact / league receipt. Dependency-free ES module.
 * Replace the existing RECEIPT_COPY and sendContactReceipt with this module.
 * Keep the existing call after the moderator email has been accepted.
 * All rendered content is fixed copy; submitted content is never included.
 */
const RECEIPT_COPY = {
  de: {
    contactSubject: "MIRoKIT · Deine Nachricht ist angekommen",
    leagueSubject: "MIRoKIT · Deine Liga-Anfrage ist angekommen",
    greeting: "Hallo!",
    contact: "Vielen Dank für deine Nachricht. Sie ist bei uns angekommen und wird in Kürze von unseren Moderatoren bearbeitet.",
    league: "Vielen Dank für deine Anfrage an die MIRoKIT-Liga. Sie ist bei uns angekommen und wird in Kürze von unseren Moderatoren bearbeitet.",
    note: "Dies ist eine automatische Eingangsbestätigung.",
    closing: "Dein MIRoKIT-Team",
    tagline: "Dialog. Spiel. Kreativität.",
    contactLabel: "Kontakt",
    leagueLabel: "MIRoKIT-Liga",
    status: "Eingang bestätigt",
    contactHeading: "Deine Nachricht ist angekommen.",
    leagueHeading: "Deine Liga-Anfrage ist angekommen.",
    noteHeading: "Gut zu wissen",
  },
  en: {
    contactSubject: "MIRoKIT · We have received your message",
    leagueSubject: "MIRoKIT · We have received your league inquiry",
    greeting: "Hello!",
    contact: "Thank you for your message. We have received it, and our moderators will review it shortly.",
    league: "Thank you for your inquiry to the MIRoKIT League. We have received it, and our moderators will review it shortly.",
    note: "This is an automatic acknowledgment of receipt.",
    closing: "Your MIRoKIT team",
    tagline: "Dialogue. Play. Creativity.",
    contactLabel: "Contact",
    leagueLabel: "MIRoKIT League",
    status: "Receipt confirmed",
    contactHeading: "Your message has arrived.",
    leagueHeading: "Your league inquiry has arrived.",
    noteHeading: "Good to know",
  },
  ru: {
    contactSubject: "МИРоКИТ · Ваше сообщение получено",
    leagueSubject: "МИРоКИТ · Ваше обращение в Лигу получено",
    greeting: "Здравствуйте!",
    contact: "Спасибо за ваше сообщение. Мы получили его, и наши модераторы рассмотрят его в ближайшее время.",
    league: "Спасибо за ваше обращение в Лигу МИРоКИТ. Мы получили его, и наши модераторы рассмотрят его в ближайшее время.",
    note: "Это автоматическое подтверждение получения сообщения.",
    closing: "Команда МИРоКИТ",
    tagline: "Диалог. Игра. Творчество.",
    contactLabel: "Контакт",
    leagueLabel: "Лига МИРоКИТ",
    status: "Получение подтверждено",
    contactHeading: "Ваше сообщение получено.",
    leagueHeading: "Ваше обращение в Лигу получено.",
    noteHeading: "Полезно знать",
  },
};

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

/** Pure builder for previews or tests; it never sends mail. */
export function buildContactReceipt({ formType, language } = {}) {
  const requestedLanguage = typeof language === "string"
    ? language.trim().toLowerCase().split(/[-_]/)[0]
    : "";
  const locale = ["de", "en", "ru"].includes(requestedLanguage) ? requestedLanguage : "ru";
  const copy = RECEIPT_COPY[locale];
  const isLeague = formType === "extra-contact";
  const subject = isLeague ? copy.leagueSubject : copy.contactSubject;
  const heading = escapeHtml(isLeague ? copy.leagueHeading : copy.contactHeading);
  const message = isLeague ? copy.league : copy.contact;
  const label = escapeHtml(isLeague ? copy.leagueLabel : copy.contactLabel);
  const brandStart = locale === "ru" ? "МИР" : "MIR";
  const brandMiddle = locale === "ru" ? "о" : "o";
  const brandEnd = locale === "ru" ? "КИТ" : "KIT";
  const text = [copy.greeting, message, copy.note, copy.closing, "https://mirokit.com/"].join("\n\n");

  // Tables and inline styles provide the base layout. Media queries enhance it.
  // Outlook Classic may show square corners and omit the decorative shadow.
  const html = `<!doctype html>
<html lang="${locale}" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,date=no,email=no,url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <style>body, table, td, h1, p, a, span { font-family:Arial,sans-serif !important; }</style>
  <![endif]-->
  <style>
    :root { color-scheme:light dark; supported-color-schemes:light dark; }
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-spacing:0; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    a:focus-visible { outline:3px solid #1565ff; outline-offset:4px; }
    @media only screen and (max-width:620px) {
      .outer-pad { padding:20px 12px !important; }
      .header-pad { padding:28px 24px 24px !important; }
      .hero-pad { padding:28px 24px !important; }
      .content-pad { padding:28px 24px 30px !important; }
      .footer-pad { padding:22px 24px !important; }
      .headline { font-size:28px !important; line-height:34px !important; }
      .wordmark { font-size:28px !important; line-height:34px !important; }
    }
    @media (prefers-color-scheme:dark) {
      .email-bg { background-color:#10182b !important; }
      .email-card { background-color:#17233a !important; border-color:#334563 !important; }
      .hero-bg { background-color:#1c3151 !important; }
      .note-bg { background-color:#20304b !important; }
      .ink { color:#f1f5ff !important; }
      .body-copy { color:#d6e1f3 !important; }
      .muted { color:#becbe0 !important; }
      .brand-blue, .email-link, .status { color:#9cc6ff !important; }
      .brand-red { color:#ff98a5 !important; }
      .footer-line { border-color:#334563 !important; }
    }
    [data-ogsc] .email-bg { background-color:#10182b !important; }
    [data-ogsc] .email-card { background-color:#17233a !important; border-color:#334563 !important; }
    [data-ogsc] .hero-bg { background-color:#1c3151 !important; }
    [data-ogsc] .note-bg { background-color:#20304b !important; }
    [data-ogsc] .ink { color:#f1f5ff !important; }
    [data-ogsc] .body-copy { color:#d6e1f3 !important; }
    [data-ogsc] .muted { color:#becbe0 !important; }
    [data-ogsc] .brand-blue, [data-ogsc] .email-link, [data-ogsc] .status { color:#9cc6ff !important; }
    [data-ogsc] .brand-red { color:#ff98a5 !important; }
    [data-ogsc] .footer-line { border-color:#334563 !important; }
  </style>
</head>
<body class="email-bg" style="margin:0; padding:0; width:100%; background-color:#f0f6ff; font-family:Arial,Helvetica,sans-serif; color:#0d1b4b;">
  <div aria-hidden="true" style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${escapeHtml(message)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg" bgcolor="#f0f6ff" style="width:100%; background-color:#f0f6ff;">
    <tr>
      <td align="center" class="outer-pad" style="padding:40px 20px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" bgcolor="#ffffff" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #dce6f5; border-radius:20px; box-shadow:0 16px 44px rgba(13,27,75,0.07);">
          <tr>
            <td class="header-pad" style="padding:32px 40px 28px;">
              <p class="wordmark" style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:30px; line-height:36px; font-weight:800; letter-spacing:-1px;"><span class="brand-blue" style="color:#1565ff;">${brandStart}</span><span class="brand-red" style="color:#d82b40;">${brandMiddle}</span><span class="brand-blue" style="color:#1565ff;">${brandEnd}</span></p>
              <p class="muted" style="margin:5px 0 0; color:#52607d; font-size:13px; line-height:20px;">${escapeHtml(copy.tagline)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <table role="presentation" aria-hidden="true" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; table-layout:fixed;">
                <tr>
                  <td width="76%" height="4" bgcolor="#1565ff" style="width:76%; height:4px; background-color:#1565ff; font-size:0; line-height:4px;">&nbsp;</td>
                  <td width="16%" height="4" bgcolor="#ff3d3d" style="width:16%; height:4px; background-color:#ff3d3d; font-size:0; line-height:4px;">&nbsp;</td>
                  <td width="8%" height="4" bgcolor="#ffd54f" style="width:8%; height:4px; background-color:#ffd54f; font-size:0; line-height:4px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="hero-bg hero-pad" bgcolor="#edf4ff" style="padding:32px 40px 34px; background-color:#edf4ff;">
              <p class="muted" style="margin:0 0 16px; color:#52607d; font-size:12px; line-height:18px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;">${label}</p>
              <h1 class="headline ink" style="margin:0 0 18px; font-family:Arial,Helvetica,sans-serif; color:#0d1b4b; font-size:36px; line-height:42px; font-weight:700; letter-spacing:-0.8px;">${heading}</h1>
              <p class="status" style="margin:0; color:#104bc1; font-size:14px; line-height:22px; font-weight:700;"><span aria-hidden="true">&#10003;&nbsp;&nbsp;</span>${escapeHtml(copy.status)}</p>
            </td>
          </tr>
          <tr>
            <td class="content-pad" style="padding:32px 40px 36px;">
              <p class="ink" style="margin:0 0 12px; color:#0d1b4b; font-size:18px; line-height:28px; font-weight:700;">${escapeHtml(copy.greeting)}</p>
              <p class="body-copy" style="margin:0 0 24px; color:#354466; font-size:16px; line-height:27px;">${escapeHtml(message)}</p>
              <p class="ink" style="margin:0 0 28px; color:#0d1b4b; font-size:16px; line-height:25px; font-weight:700;">${escapeHtml(copy.closing)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                  <td class="note-bg" bgcolor="#f4f7fc" style="padding:16px 18px; background-color:#f4f7fc; border-left:3px solid #1565ff; border-radius:0 8px 8px 0;">
                    <p class="ink" style="margin:0 0 4px; color:#0d1b4b; font-size:14px; line-height:22px; font-weight:700;">${escapeHtml(copy.noteHeading)}</p>
                    <p class="muted" style="margin:0; color:#52607d; font-size:14px; line-height:22px;">${escapeHtml(copy.note)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="footer-pad footer-line" style="padding:22px 40px; border-top:1px solid #e4ebf6;">
              <p style="margin:0; font-size:13px; line-height:22px;"><a class="email-link" href="https://mirokit.com/" style="color:#104bc1; text-decoration:underline; text-underline-offset:3px; font-weight:700;">mirokit.com</a><span class="muted" style="color:#52607d;">&nbsp;&nbsp;·&nbsp;&nbsp;${locale === "ru" ? "МИРоКИТ" : "MIRoKIT"}</span></p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { locale, subject, text, html };
}

// Called only after the moderator email has been accepted by the mail service.
// Keep submitted names, messages and links out of the automatic reply.
export async function sendContactReceipt(env, { formType, language, senderEmail, mailFrom }) {
  // Wrangler .dev.vars values are strings: "false" must not count as truthy.
  // Keep the existing enabled behavior when no switch is configured.
  if (String(env.USE_SEND_EMAIL_RESPONSE ?? "true").trim().toLowerCase() !== "true") return;

  try {
    if (!env.CONTACT_RECEIPT_EMAIL?.send) {
      console.error("MIRoKIT contact receipt unavailable", { formType, code: "MISSING_BINDING" });
      return;
    }

    const { locale, subject, text, html } = buildContactReceipt({ formType, language });
    const result = await env.CONTACT_RECEIPT_EMAIL.send({
      to: senderEmail,
      from: { email: mailFrom, name: "MIRoKIT" },
      replyTo: { email: mailFrom, name: "MIRoKIT" },
      subject,
      text,
      html,
      headers: { "Auto-Submitted": "auto-generated", "Content-Language": locale },
    });
    console.log("MIRoKIT contact receipt sent", { formType, messageId: result.messageId });
  } catch (error) {
    // A failed receipt must not turn an accepted inquiry into a failed form
    // submission, which could prompt visitors to send the same inquiry again.
    console.error("MIRoKIT contact receipt failed", { formType, code: error?.code || "SEND_FAILED" });
  }
}
