import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendPasswordResetEmail(email, resetUrl) {
  if (!transporter) {
    console.log(`[DEV] 비밀번호 재설정 링크 → ${email} : ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: `"BARO" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '[BARO] 비밀번호 재설정',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px;">
        <h2 style="color:#4f46e5;margin-bottom:8px;">BARO 비밀번호 재설정</h2>
        <p style="color:#475569;">아래 버튼을 클릭하여 비밀번호를 재설정하세요:</p>
        <div style="text-align:center;padding:24px 0;">
          <a href="${resetUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:900;font-size:15px;">비밀번호 재설정</a>
        </div>
        <p style="color:#94a3b8;font-size:13px;">이 링크는 30분간 유효합니다. 본인이 요청하지 않았다면 무시하세요.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(email, code) {
  if (!transporter) {
    console.log(`[DEV] 인증번호 → ${email} : ${code}`);
    return;
  }

  await transporter.sendMail({
    from: `"BARO" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '[BARO] 이메일 인증번호',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px;">
        <h2 style="color:#4f46e5;margin-bottom:8px;">BARO 이메일 인증</h2>
        <p style="color:#475569;">아래 인증번호를 입력해주세요:</p>
        <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#1e293b;text-align:center;padding:24px 0;">
          ${code}
        </div>
        <p style="color:#94a3b8;font-size:13px;">이 인증번호는 10분간 유효합니다.</p>
      </div>
    `,
  });
}
