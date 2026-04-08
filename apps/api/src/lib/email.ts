// Resend wrapper for transactional email (OTP).
// Docs: https://resend.com/docs/api-reference/emails/send-email

interface SendOpts {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendOpts): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${body}`);
  }
}

export function buildOtpEmail(code: string, appName: string): { subject: string; html: string; text: string } {
  const subject = `${appName} 登入驗證碼: ${code}`;
  const text = `你的 ${appName} 登入驗證碼是 ${code}\n\n10 分鐘內有效。如果不是你本人請忽略這封信。`;
  const html = `
<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f7;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 16px;color:#1d1d1f;">${appName} 登入驗證碼</h2>
    <p style="color:#6e6e73;margin:0 0 24px;">在 app 內輸入下方驗證碼完成登入。</p>
    <div style="font-size:36px;font-weight:600;letter-spacing:6px;color:#1d1d1f;background:#f5f5f7;padding:16px;border-radius:8px;text-align:center;font-family:'SF Mono',Menlo,monospace;">
      ${code}
    </div>
    <p style="color:#6e6e73;margin:24px 0 0;font-size:13px;">10 分鐘內有效。如果不是你本人請忽略這封信。</p>
  </div>
</body>
</html>`.trim();
  return { subject, html, text };
}
