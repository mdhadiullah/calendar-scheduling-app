interface TemplateBase {
  recipientName: string;
  appUrl: string;
}

function layout(title: string, bodyHtml: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr><td style="background:#4F46E5;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">Calendar &amp; Scheduling</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 32px;background:#f4f5f7;font-size:12px;color:#697386;">
            You are receiving this email because of activity on your Calendar &amp; Scheduling account.
            <a href="${appUrl}/settings/notifications" style="color:#4F46E5;">Manage notification preferences</a>.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">${label}</a>`;

export function meetingInvitationEmail(p: TemplateBase & { meetingTitle: string; startAt: string; location?: string; meetingUrl: string }) {
  return layout(
    'New meeting invitation',
    `<p>Hi ${p.recipientName},</p>
     <p>You have been invited to <strong>${p.meetingTitle}</strong>, scheduled for <strong>${p.startAt}</strong>.</p>
     ${p.location ? `<p>Location: ${p.location}</p>` : ''}
     ${button(p.meetingUrl, 'View meeting')}`,
    p.appUrl
  );
}

export function meetingReminderEmail(p: TemplateBase & { meetingTitle: string; startAt: string; minutesBefore: number; meetingUrl: string }) {
  return layout(
    `Reminder: ${p.meetingTitle} starts soon`,
    `<p>Hi ${p.recipientName},</p>
     <p>Your meeting <strong>${p.meetingTitle}</strong> starts at <strong>${p.startAt}</strong> (in about ${p.minutesBefore} minutes).</p>
     ${button(p.meetingUrl, 'View meeting')}`,
    p.appUrl
  );
}

export function meetingCancelledEmail(p: TemplateBase & { meetingTitle: string; startAt: string; reason?: string }) {
  return layout(
    'Meeting cancelled',
    `<p>Hi ${p.recipientName},</p>
     <p><strong>${p.meetingTitle}</strong> originally scheduled for <strong>${p.startAt}</strong> has been cancelled.</p>
     ${p.reason ? `<p>Reason: ${p.reason}</p>` : ''}`,
    p.appUrl
  );
}

export function meetingRescheduledEmail(p: TemplateBase & { meetingTitle: string; oldStartAt: string; newStartAt: string; meetingUrl: string }) {
  return layout(
    'Meeting rescheduled',
    `<p>Hi ${p.recipientName},</p>
     <p><strong>${p.meetingTitle}</strong> has been moved from <strong>${p.oldStartAt}</strong> to <strong>${p.newStartAt}</strong>.</p>
     ${button(p.meetingUrl, 'View meeting')}`,
    p.appUrl
  );
}

export function trialExpiringEmail(p: TemplateBase & { daysRemaining: number }) {
  return layout(
    'Your trial is ending soon',
    `<p>Hi ${p.recipientName},</p>
     <p>Your 15-day trial ends in <strong>${p.daysRemaining} day${p.daysRemaining === 1 ? '' : 's'}</strong>. Contact your administrator to activate your full account and keep uninterrupted access.</p>`,
    p.appUrl
  );
}

export function trialExpiredEmail(p: TemplateBase) {
  return layout(
    'Your trial has ended',
    `<p>Hi ${p.recipientName},</p>
     <p>Your 15-day trial has ended and normal application access is now paused. Contact your administrator to activate your account.</p>`,
    p.appUrl
  );
}

export function accountCreatedEmail(p: TemplateBase & { activationUrl: string }) {
  return layout(
    'Your account has been created',
    `<p>Hi ${p.recipientName},</p>
     <p>An administrator has created a Calendar &amp; Scheduling account for you. Set your password to activate it:</p>
     ${button(p.activationUrl, 'Activate my account')}
     <p style="font-size:12px;color:#697386;margin-top:16px;">This link expires in 24 hours and can only be used once.</p>`,
    p.appUrl
  );
}

export function accountActivatedEmail(p: TemplateBase) {
  return layout(
    'Your account is active',
    `<p>Hi ${p.recipientName},</p>
     <p>Your account now has full access. Thank you for using Calendar &amp; Scheduling!</p>`,
    p.appUrl
  );
}

export function passwordResetEmail(p: TemplateBase & { resetUrl: string }) {
  return layout(
    'Reset your password',
    `<p>Hi ${p.recipientName},</p>
     <p>We received a request to reset your password. If this was not you, you can safely ignore this email.</p>
     ${button(p.resetUrl, 'Reset password')}
     <p style="font-size:12px;color:#697386;margin-top:16px;">This link expires in 1 hour.</p>`,
    p.appUrl
  );
}

export function accountLockedEmail(p: TemplateBase) {
  return layout(
    'Your account has been locked',
    `<p>Hi ${p.recipientName},</p>
     <p>An administrator has locked your account. Contact your administrator for details.</p>`,
    p.appUrl
  );
}

export function accountUnlockedEmail(p: TemplateBase) {
  return layout(
    'Your account has been unlocked',
    `<p>Hi ${p.recipientName},</p>
     <p>Your account has been unlocked and you may sign in again.</p>`,
    p.appUrl
  );
}
