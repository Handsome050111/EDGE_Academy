const fs = require('fs');
const path = require('path');
const dns = require('dns');
const nodemailer = require('nodemailer');
const { createNotification } = require('../controllers/notificationController');

const cleanEnv = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
};

let smtpTransporter = null;

const getSmtpTransporter = () => {
  const host = cleanEnv(process.env.SMTP_HOST) || 'send.one.com';
  const rawPort = cleanEnv(process.env.SMTP_PORT);
  const parsedPort = parseInt(rawPort, 10);
  const port = isNaN(parsedPort) ? 587 : parsedPort;
  const user = cleanEnv(process.env.SMTP_USER);
  const pass = cleanEnv(process.env.SMTP_PASS);
  const rawSecure = cleanEnv(process.env.SMTP_SECURE);

  let secure = false;
  if (rawSecure === 'true') {
    secure = true;
  } else if (rawSecure === 'false') {
    secure = false;
  } else {
    secure = port === 465;
  }

  if (user && pass) {
    if (!smtpTransporter) {
      smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        // Strictly enforce IPv4 at the socket lookup level
        lookup: (hostname, options, callback) => {
          return dns.lookup(hostname, { family: 4, all: false }, callback);
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
    return smtpTransporter;
  }
  return null;
};

let resendClient = null;
const resendKey = cleanEnv(process.env.RESEND_API_KEY);
if (resendKey) {
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(resendKey);
  } catch (err) {
    console.error('Failed to initialize Resend client:', err.message);
  }
}

/**
 * Dispatches an email notification via SMTP (Nodemailer / one.com) or Resend API with console logging fallback.
 */
const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
  try {
    const recipient = Array.isArray(to) ? to.join(', ') : to;

    // In production or test, log structured email output
    console.log(`\n================== [EMAIL DISPATCH] ==================`);
    console.log(`TO:          ${recipient}`);
    console.log(`SUBJECT:     ${subject}`);
    if (attachments && attachments.length > 0) {
      console.log(`ATTACHMENTS: ${attachments.map((a) => a.filename || a.path).join(', ')}`);
    }
    console.log(`BODY:        ${text || subject}`);
    console.log(`======================================================\n`);

    const transporter = getSmtpTransporter();

    if (transporter) {
      // 1. Dispatch via SMTP (Nodemailer / one.com)
      const senderFrom = cleanEnv(process.env.SMTP_FROM) || cleanEnv(process.env.SMTP_USER) || 'EDGE Academy <khaista.rehman@technonex.de>';

      const mailOptions = {
        from: senderFrom,
        to,
        subject,
        text: text || subject,
        html: html || `<p>${text || subject}</p>`,
        attachments: (attachments || []).map((att) => {
          if (att.path && fs.existsSync(att.path)) {
            return {
              filename: att.filename || path.basename(att.path),
              path: att.path,
            };
          }
          return att;
        }),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP Success] Email delivered to ${recipient}. Message ID: ${info.messageId}`);
      return true;
    } else if (resendClient || process.env.RESEND_API_KEY) {
      // 2. Dispatch via Resend API
      try {
        if (!resendClient) {
          const { Resend } = require('resend');
          resendClient = new Resend(process.env.RESEND_API_KEY);
        }

        const resendAttachments = (attachments || []).map((att) => {
          if (att.path && fs.existsSync(att.path)) {
            return {
              filename: att.filename || path.basename(att.path),
              content: fs.readFileSync(att.path),
            };
          }
          return att;
        });

        const { data, error } = await resendClient.emails.send({
          from: process.env.RESEND_FROM || 'EDGE Academy <onboarding@resend.dev>',
          to: Array.isArray(to) ? to : [to],
          subject,
          text: text || subject,
          html: html || `<p>${text || subject}</p>`,
          attachments: resendAttachments,
        });

        if (error) {
          console.error(`[Resend Error] Failed to send email to ${recipient}:`, error.message);
        } else {
          console.log(`[Resend Success] Email delivered to ${recipient}. Message ID: ${data?.id}`);
        }
      } catch (resendErr) {
        console.error(`[Resend Exception] Error sending to ${recipient}:`, resendErr.message);
      }
    }

    return true;
  } catch (error) {
    console.error(`[Email Service] Failed to send email to ${to}:`, error.message);
    return false;
  }
};

/**
 * Sends dual notifications (in-app bell + email) upon Team Lead assignment
 * directly to both the Field Engineer and the Team Lead.
 */
const notifyTeamLeadAssignment = async ({ engineer, teamLead }) => {
  try {
    if (!engineer || !teamLead) return;

    const engineerName = engineer.full_name || engineer.fullName || engineer.email;
    const leadName = teamLead.full_name || teamLead.fullName || teamLead.email || 'Your Team Lead';

    // 1. Dual Notification for the Field Engineer
    const engineerBellMessage = `You have been assigned to Team Lead ${leadName}.`;
    await createNotification({
      recipient_id: engineer._id,
      title: 'Team Lead Assigned',
      message: engineerBellMessage,
      type: 'assignment',
      link: '/engineer',
    });

    const engineerEmailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #ffffff;">
        <div style="background-color: #092857; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">EDGE Academy</h1>
          <p style="color: #93C5FD; margin: 4px 0 0 0; font-size: 13px;">Team Lead Assignment</p>
        </div>
        <div style="padding: 0 8px; color: #1E293B; line-height: 1.6;">
          <p style="font-size: 15px;">Hello <strong>${engineerName}</strong>,</p>
          <p style="font-size: 14px;">You have been assigned to Team Lead <strong>${leadName}</strong> in EDGE Academy.</p>
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;">Assigned Team Lead: <strong style="color: #0F172A;">${leadName}</strong></p>
            <p style="margin: 0; font-size: 13px; color: #64748B;">Lead Email: <strong style="color: #0F172A;">${teamLead.email}</strong></p>
          </div>
          <p style="font-size: 13px; color: #475569;">You can now view your assigned curriculum tracks, upcoming field modules, and coordinate directly with your lead.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: engineer.email,
      subject: `EDGE Academy — Assigned to Team Lead: ${leadName}`,
      text: `Hello ${engineerName},\n\nYou have been assigned to Team Lead ${leadName} (${teamLead.email}).\n\nAccess your dashboard at: /engineer`,
      html: engineerEmailHtml,
    });

    // 2. Dual Notification for the Team Lead
    if (teamLead.email) {
      const leadBellMessage = `${engineerName} has been assigned to you as your engineer.`;
      await createNotification({
        recipient_id: teamLead._id,
        title: 'New Engineer Assigned',
        message: leadBellMessage,
        type: 'invite',
        link: '/team-lead',
      });

      const leadEmailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #092857; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">EDGE Academy</h1>
            <p style="color: #93C5FD; margin: 4px 0 0 0; font-size: 13px;">Engineer Assignment Notification</p>
          </div>
          <div style="padding: 0 8px; color: #1E293B; line-height: 1.6;">
            <p style="font-size: 15px;">Hello <strong>${leadName}</strong>,</p>
            <p style="font-size: 14px;"><strong>${engineerName}</strong> has been assigned to you as your engineer.</p>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;">Engineer: <strong style="color: #0F172A;">${engineerName}</strong></p>
              <p style="margin: 0; font-size: 13px; color: #64748B;">Email: <strong style="color: #0F172A;">${engineer.email}</strong></p>
            </div>
            <p style="font-size: 13px; color: #475569;">You can track their module progress and assign training curriculum directly from your Team Lead dashboard.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: teamLead.email,
        subject: `EDGE Academy — New Engineer Assigned: ${engineerName}`,
        text: `Hello ${leadName},\n\n${engineerName} (${engineer.email}) has been assigned to you.\n\nTrack progress at: /team-lead`,
        html: leadEmailHtml,
      });
    }
  } catch (error) {
    console.error('Error sending dual team lead assignment notifications:', error.message);
  }
};

/**
 * Sends dual notifications (in-app bell + email) upon team assignment
 */
const notifyTeamAssignment = async ({ engineer, team, teamLead }) => {
  if (teamLead) {
    return notifyTeamLeadAssignment({ engineer, teamLead });
  }
};

/**
 * Sends dual notifications (in-app bell + email) upon module or track assignment.
 */
const notifyAssignment = async ({ engineer, assignedBy, itemType = 'module', itemTitle, deadline, moduleCount = 1 }) => {
  try {
    if (!engineer) return;

    const engineerName = engineer.full_name || engineer.fullName || engineer.email;
    const assignerName = assignedBy?.full_name || assignedBy?.fullName || assignedBy?.email || 'Your Team Lead';
    const deadlineStr = deadline
      ? new Date(deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'No fixed deadline';

    const isTrack = itemType === 'track';
    const titleText = isTrack ? `Track Assigned: ${itemTitle}` : `Module Assigned: ${itemTitle}`;
    const messageText = isTrack
      ? `You have been assigned track '${itemTitle}' (${moduleCount} modules) by ${assignerName}. Target deadline: ${deadlineStr}.`
      : `You have been assigned module '${itemTitle}' by ${assignerName}. Target deadline: ${deadlineStr}.`;

    // 1. In-App Bell Notification
    await createNotification({
      recipient_id: engineer._id,
      title: titleText,
      message: messageText,
      type: 'assignment',
      link: '/engineer',
    });

    // 2. Formatted Email Notification
    if (engineer.email) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #08306B 0%, #0066CC 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">TECHNONEX EDGE ACADEMY</h1>
            <p style="color: #93C5FD; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Field Operations Training & Certification</p>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; color: #1E293B; margin-top: 0;">Hello <strong>${engineerName}</strong>,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              You have been assigned new training content by <strong>${assignerName}</strong>:
            </p>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #0F172A;"><strong>${itemTitle}</strong></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B;">Type: <strong style="color: #0F172A;">${isTrack ? `Full Track (${moduleCount} sequential modules)` : 'Single Module'}</strong></p>
              <p style="margin: 0; font-size: 13px; color: #64748B;">Completion Deadline: <strong style="color: #08306B;">${deadlineStr}</strong></p>
            </div>
            <p style="font-size: 13px; color: #475569;">Please log in to your Engineer Dashboard to review instructional materials, watch module videos, and complete required topic quizzes.</p>
            <div style="text-align: center; margin: 28px 0 16px 0;">
              <a href="${frontendUrl}/engineer" style="background-color: #08306B; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block;">
                Access Engineer Dashboard
              </a>
            </div>
          </div>
        </div>
      `;

      await sendEmail({
        to: engineer.email,
        subject: `EDGE Academy — ${titleText}`,
        text: `Hello ${engineerName},\n\nYou have been assigned: ${itemTitle} (${isTrack ? `${moduleCount} modules` : 'Module'})\nAssigned By: ${assignerName}\nDeadline: ${deadlineStr}\n\nAccess your dashboard: ${frontendUrl}/engineer`,
        html: emailHtml,
      });
    }
  } catch (error) {
    console.error('Error sending dual assignment notification:', error.message);
  }
};

/**
 * Sends celebratory dual notification (in-app bell + email with PDF attachment)
 * directly to the engineer when an official track certificate is earned.
 */
const notifyCertificateIssued = async ({ engineer, certificate, track }) => {
  try {
    if (!engineer || !certificate) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const engineerName = engineer.full_name || engineer.fullName || engineer.email;
    const trackTitle = track?.title || track?.name || 'Curriculum Track';
    const certId = certificate.certificate_id;
    const tier = certificate.tier || 'CORE';
    const pdfPath = path.join(__dirname, '..', certificate.pdf_storage_path);
    const verifyUrl = `${frontendUrl}/verify/${certId}`;

    // 1. In-App Bell Notification
    await createNotification({
      recipient_id: engineer._id,
      title: `🎉 Certificate Earned: ${certId}`,
      message: `Congratulations! You have completed '${trackTitle}' (${tier}) and earned certificate ${certId}. Your official certificate PDF is attached to your email.`,
      type: 'certificate',
      link: `/verify/${certId}`,
    });

    // 2. Email Notification with attached PDF
    if (engineer.email) {
      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #0A2540; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">TECHNONEX EDGE ACADEMY</h1>
            <p style="color: #D4AF37; margin: 6px 0 0 0; font-size: 14px; font-weight: 600;">Official Certificate of Achievement</p>
          </div>
          <div style="padding: 0 8px; color: #1E293B; line-height: 1.6;">
            <p style="font-size: 16px;">Dear <strong>${engineerName}</strong>,</p>
            <p style="font-size: 14px;">Congratulations on successfully completing the <strong>${trackTitle}</strong> curriculum track within the <strong>${tier}</strong> program!</p>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;">Certificate ID: <strong style="color: #0A2540; font-family: monospace; font-size: 14px;">${certId}</strong></p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;">Curriculum Track: <strong style="color: #0F172A;">${trackTitle}</strong></p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B;">Program Tier: <strong style="color: #0A2540;">${tier}</strong></p>
              <p style="margin: 0; font-size: 13px; color: #64748B;">Status: <strong style="color: #16A34A;">Active & Verified</strong></p>
            </div>
            <p style="font-size: 13px; color: #475569;">Your official high-resolution certificate PDF is attached to this email. You can also view and verify your credential online anytime at the official portal:</p>
            <div style="text-align: center; margin: 28px 0 20px 0;">
              <a href="${verifyUrl}" style="background-color: #0A2540; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block;">
                View & Verify Certificate Online
              </a>
            </div>
            <p style="font-size: 12px; color: #94A3B8; text-align: center; margin-top: 24px;">Technonex EDGE Academy · Engineering Development & Growth Ecosystem</p>
          </div>
        </div>
      `;

      const attachments = [];
      if (fs.existsSync(pdfPath)) {
        attachments.push({
          filename: `${certId}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf',
        });
      }

      await sendEmail({
        to: engineer.email,
        subject: `🎉 Congratulations! Your Technonex Certificate for ${trackTitle} (${certId})`,
        text: `Dear ${engineerName},\n\nCongratulations! You have completed '${trackTitle}' and earned certificate ${certId} (${tier}).\n\nYour certificate PDF is attached. Verify online: ${verifyUrl}`,
        html: emailHtml,
        attachments,
      });
    }
  } catch (error) {
    console.error('Error sending certificate issuance email notification:', error.message);
  }
};

/**
 * Sends invitation notification (in-app bell + email) with activation link to a newly invited user.
 */
const notifyUserInvitation = async ({ user, token, isResend = false }) => {
  try {
    if (!user || !user.email) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userName = user.full_name || user.fullName || user.email.split('@')[0];
    const userRole = (user.role || 'engineer').replace('_', ' ').toUpperCase();
    const activationLink = `${frontendUrl}/invite/accept?token=${token}`;

    // 1. In-App Bell Notification
    await createNotification({
      recipient_id: user._id,
      title: isResend ? 'Invitation Resent' : 'Welcome to EDGE Academy',
      message: `You have been invited to join EDGE Academy as '${user.role}'.`,
      type: 'invite',
      link: `/invite/accept?token=${token}`,
    });

    // 2. Formatted Email Notification via Resend
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #08306B 0%, #0066CC 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">TECHNONEX EDGE ACADEMY</h1>
          <p style="color: #93C5FD; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Field Operations Training & Certification Platform</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="font-size: 15px; color: #1E293B; margin-top: 0;">Hello <strong>${userName}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            You have been invited to join the <strong>Technonex EDGE Academy</strong> platform as an official <strong>${userRole}</strong>.
          </p>
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B;">Registered Email: <strong style="color: #0F172A;">${user.email}</strong></p>
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B;">Assigned Role: <strong style="color: #08306B;">${userRole}</strong></p>
            <p style="margin: 0; font-size: 13px; color: #64748B;">Invitation Validity: <strong style="color: #16A34A;">48 Hours</strong></p>
          </div>
          <p style="font-size: 13px; color: #475569;">Click the button below to accept your invitation, set up your secure password, and activate your account:</p>
          <div style="text-align: center; margin: 28px 0 20px 0;">
            <a href="${activationLink}" style="background-color: #08306B; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block;">
              Activate Your Account
            </a>
          </div>
          <p style="font-size: 12px; color: #94A3B8; text-align: center; margin-top: 24px;">If the button above does not work, copy and paste this link into your browser:<br/><a href="${activationLink}" style="color: #0066CC;">${activationLink}</a></p>
        </div>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: isResend ? `EDGE Academy — Invitation Resent` : `Welcome to EDGE Academy — Activate Your Account`,
      text: `Hello ${userName},\n\nYou have been invited to join EDGE Academy as '${userRole}'.\n\nActivate your account: ${activationLink}\n(Link expires in 48 hours)`,
      html: emailHtml,
    });
  } catch (error) {
    console.error('Error sending invitation email notification:', error.message);
  }
};

/**
 * Sends a password reset notification email with secure link.
 */
const notifyPasswordReset = async ({ user, token }) => {
  try {
    if (!user || !user.email) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userName = user.full_name || user.fullName || user.email.split('@')[0];
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #08306B 0%, #0066CC 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">TECHNONEX EDGE ACADEMY</h1>
          <p style="color: #93C5FD; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Password Reset Request</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="font-size: 15px; color: #1E293B; margin-top: 0;">Hello <strong>${userName}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            We received a request to reset your password for your <strong>Technonex EDGE Academy</strong> account.
          </p>
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B;">Account Email: <strong style="color: #0F172A;">${user.email}</strong></p>
            <p style="margin: 0; font-size: 13px; color: #64748B;">Link Validity: <strong style="color: #DC2626;">60 Minutes</strong></p>
          </div>
          <p style="font-size: 13px; color: #475569;">Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 28px 0 20px 0;">
            <a href="${resetLink}" style="background-color: #08306B; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block;">
              Set New Password
            </a>
          </div>
          <p style="font-size: 12px; color: #94A3B8; text-align: center; margin-top: 24px;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: `EDGE Academy — Password Reset Request`,
      text: `Hello ${userName},\n\nWe received a request to reset your password.\n\nSet your new password: ${resetLink}\n(This link expires in 60 minutes)`,
      html: emailHtml,
    });
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
  }
};

module.exports = {
  sendEmail,
  notifyUserInvitation,
  notifyPasswordReset,
  notifyTeamAssignment,
  notifyTeamLeadAssignment,
  notifyAssignment,
  notifyCertificateIssued,
};

