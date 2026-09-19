import { Resend } from 'resend'

// Resend client is initialized with the environment variable if present.
const resendApiKey = process.env.RESEND_API_KEY
export const resend = resendApiKey ? new Resend(resendApiKey) : null

// Default sender. Resend provides "onboarding@resend.dev" for testing without custom domain.
// Once a custom domain is verified in Resend, change EMAIL_FROM in backend/.env to e.g. "Style Sence <concierge@stylesence.com>".
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Style Sence <onboarding@resend.dev>'

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:3000'
}

function formatNaira(amount: number): string {
  return '₦' + Math.round(amount).toLocaleString('en-NG')
}

/* ------------------------------------------------------------------ *
 * Base Luxury Email Layout Wrapper
 * ------------------------------------------------------------------ */
function luxuryEmailLayout(title: string, preheader: string, contentHtml: string): string {
  const siteUrl = getFrontendUrl()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f7f6f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e3dc; }
    .header { padding: 40px 32px 30px; text-align: center; border-bottom: 1px solid #f0eee6; }
    .brand-title { font-family: 'Times New Roman', Georgia, serif; font-size: 24px; letter-spacing: 0.28em; text-transform: uppercase; color: #1a1a1a; margin: 0; font-weight: 400; }
    .brand-sub { font-size: 10px; letter-spacing: 0.35em; text-transform: uppercase; color: #888478; margin-top: 6px; }
    .content { padding: 40px 32px; font-size: 14px; line-height: 1.7; color: #2e2d29; }
    .button { display: inline-block; padding: 14px 28px; background-color: #1a1a1a; color: #ffffff !important; text-decoration: none; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 500; border-radius: 0; margin-top: 24px; }
    .footer { padding: 32px; background-color: #faf9f5; border-top: 1px solid #f0eee6; text-align: center; font-size: 11px; color: #888478; line-height: 1.6; }
    .divider { height: 1px; background-color: #e5e3dc; margin: 24px 0; }
    .item-row td { padding: 12px 0; border-bottom: 1px solid #f0eee6; font-size: 13px; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f6f2; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table class="container" width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td class="header">
              <h1 class="brand-title">STYLE SENCE</h1>
              <div class="brand-sub">ATELIER DU LUXE &bull; NIGERIA</div>
            </td>
          </tr>
          <tr>
            <td class="content">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin: 0 0 8px;">STYLE SENCE &bull; Bespoke tailoring, ready-to-wear & luxury essentials</p>
              <p style="margin: 0 0 12px;">WhatsApp Concierge: +234 816 302 2233</p>
              <p style="margin: 0; font-size: 10px; color: #a39f93;">
                &copy; ${new Date().getFullYear()} Style Sence. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/* ------------------------------------------------------------------ *
 * 1. Order Confirmation Receipt
 * ------------------------------------------------------------------ */
export interface OrderEmailData {
  orderNumber: string
  fullName: string
  email: string
  phone?: string | null
  address: string
  city: string
  state: string
  shippingMethod: string
  shipping: number
  subtotal: number
  discount: number
  total: number
  items: {
    productName: string
    size: string
    color: string
    qty: number
    unitPrice: number
    imageUrl?: string | null
  }[]
}

export async function sendOrderConfirmationEmail(order: OrderEmailData) {
  const siteUrl = getFrontendUrl()
  const trackUrl = `${siteUrl}/#/track-order?lookup=${encodeURIComponent(order.orderNumber)}`

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr class="item-row">
      <td width="55" valign="top" style="padding-right: 12px;">
        ${
          item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.productName}" width="50" height="65" style="object-fit: cover; border: 1px solid #e5e3dc; display: block;" />`
            : `<div style="width: 50px; height: 65px; background: #f0eee6;"></div>`
        }
      </td>
      <td valign="top">
        <strong style="font-size: 13px; color: #1a1a1a;">${item.productName}</strong><br>
        <span style="font-size: 11px; color: #777368;">Size: ${item.size} &bull; Color: ${item.color}</span><br>
        <span style="font-size: 11px; color: #777368;">Qty: ${item.qty}</span>
      </td>
      <td align="right" valign="top" style="font-family: 'Times New Roman', Georgia, serif; font-size: 14px; font-weight: 600;">
        ${formatNaira(item.unitPrice * item.qty)}
      </td>
    </tr>
  `
    )
    .join('')

  const contentHtml = `
    <h2 style="font-family: 'Times New Roman', Georgia, serif; font-size: 20px; font-weight: 400; margin: 0 0 12px; color: #1a1a1a;">
      Order Confirmed
    </h2>
    <p style="margin: 0 0 20px; color: #666257;">
      Dear ${order.fullName}, thank you for your acquisition. We have received order <strong>#${order.orderNumber}</strong> and our atelier is preparing your pieces with meticulous care.
    </p>

    <div style="background-color: #faf9f5; border: 1px solid #f0eee6; padding: 16px 20px; margin-bottom: 28px;">
      <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #888478; margin-bottom: 4px;">Order Reference</div>
      <div style="font-family: monospace; font-size: 16px; font-weight: 600; color: #1a1a1a;">${order.orderNumber}</div>
    </div>

    <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #888478; margin: 0 0 12px;">Order Summary</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      ${itemsHtml}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 4px 0; color: #777368;">Subtotal</td>
        <td align="right" style="padding: 4px 0;">${formatNaira(order.subtotal)}</td>
      </tr>
      ${
        order.discount > 0
          ? `<tr>
        <td style="padding: 4px 0; color: #2e6930;">Privilege Discount</td>
        <td align="right" style="padding: 4px 0; color: #2e6930;">-${formatNaira(order.discount)}</td>
      </tr>`
          : ''
      }
      <tr>
        <td style="padding: 4px 0; color: #777368;">Shipping (${order.shippingMethod === 'express' ? 'Express Dispatch' : 'Standard Delivery'})</td>
        <td align="right" style="padding: 4px 0;">${order.shipping === 0 ? 'Complimentary' : formatNaira(order.shipping)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0 4px; font-weight: 600; font-size: 15px; border-top: 1px solid #e5e3dc;">Total Paid</td>
        <td align="right" style="padding: 12px 0 4px; font-weight: 700; font-size: 17px; font-family: 'Times New Roman', Georgia, serif; border-top: 1px solid #e5e3dc;">${formatNaira(order.total)}</td>
      </tr>
    </table>

    <div class="divider"></div>

    <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #888478; margin: 0 0 8px;">Delivery Address</h3>
    <p style="margin: 0 0 24px; color: #555248; font-size: 13px; line-height: 1.5;">
      ${order.address}<br>
      ${order.city}, ${order.state}
      ${order.phone ? `<br>Phone: ${order.phone}` : ''}
    </p>

    <div style="text-align: center;">
      <a href="${trackUrl}" class="button" target="_blank">Track Order Status</a>
    </div>
  `

  return sendEmail({
    to: order.email,
    subject: `Order Confirmation #${order.orderNumber} — Style Sence`,
    html: luxuryEmailLayout(`Order Confirmation #${order.orderNumber}`, `Your Style Sence order #${order.orderNumber} is confirmed`, contentHtml),
  })
}

/* ------------------------------------------------------------------ *
 * 2. Order Status Update Notification
 * ------------------------------------------------------------------ */
export async function sendOrderStatusUpdateEmail(order: {
  orderNumber: string
  fullName: string
  email: string
  status: string
}) {
  const siteUrl = getFrontendUrl()
  const trackUrl = `${siteUrl}/#/track-order?lookup=${encodeURIComponent(order.orderNumber)}`

  const statusLabels: Record<string, { title: string; desc: string }> = {
    PROCESSING: {
      title: 'In Production & Atelier Preparation',
      desc: 'Our artisans have begun preparing your tailoring and hand-finishing your pieces.',
    },
    SHIPPED: {
      title: 'Dispatched for Delivery',
      desc: 'Your order has been packaged in our signature luxury presentation box and handed to our courier partners for delivery.',
    },
    DELIVERED: {
      title: 'Delivered',
      desc: 'Your pieces have been safely delivered. We hope they bring timeless elegance to your wardrobe.',
    },
    CANCELLED: {
      title: 'Order Cancelled',
      desc: 'Your order has been cancelled and any eligible refund has been initiated.',
    },
  }

  const info = statusLabels[order.status] || {
    title: `Order Status: ${order.status}`,
    desc: `Your order status has been updated to ${order.status}.`,
  }

  const contentHtml = `
    <h2 style="font-family: 'Times New Roman', Georgia, serif; font-size: 20px; font-weight: 400; margin: 0 0 12px; color: #1a1a1a;">
      ${info.title}
    </h2>
    <p style="margin: 0 0 20px; color: #666257;">
      Dear ${order.fullName}, here is an update regarding order <strong>#${order.orderNumber}</strong>.
    </p>
    <div style="background-color: #faf9f5; border-left: 3px solid #1a1a1a; padding: 16px 20px; margin-bottom: 28px;">
      <p style="margin: 0; font-size: 13px; color: #2e2d29; line-height: 1.6;">
        ${info.desc}
      </p>
    </div>
    <div style="text-align: center;">
      <a href="${trackUrl}" class="button" target="_blank">View Order Tracking</a>
    </div>
  `

  return sendEmail({
    to: order.email,
    subject: `Update on Order #${order.orderNumber} — ${info.title}`,
    html: luxuryEmailLayout(`Order Update #${order.orderNumber}`, info.desc, contentHtml),
  })
}

/* ------------------------------------------------------------------ *
 * 3. Password Reset Email
 * ------------------------------------------------------------------ */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const contentHtml = `
    <h2 style="font-family: 'Times New Roman', Georgia, serif; font-size: 20px; font-weight: 400; margin: 0 0 12px; color: #1a1a1a;">
      Password Reset Request
    </h2>
    <p style="margin: 0 0 20px; color: #666257;">
      We received a request to reset the password for your Style Sence client account. Click the button below to establish your new security credentials:
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
    </div>
    <p style="margin: 0 0 12px; font-size: 12px; color: #888478;">
      This link is valid for 1 hour. If you did not initiate this request, you may disregard this correspondence with complete peace of mind.
    </p>
    <p style="margin: 0; font-size: 11px; color: #aaa69b; word-break: break-all;">
      Button not working? Copy and paste this link in your browser:<br>
      <a href="${resetUrl}" style="color: #666257;">${resetUrl}</a>
    </p>
  `

  return sendEmail({
    to: email,
    subject: `Password Reset Request — Style Sence`,
    html: luxuryEmailLayout('Reset Your Password', 'Instructions to reset your Style Sence password', contentHtml),
  })
}

/* ------------------------------------------------------------------ *
 * 4. Newsletter Welcome & Privilege Invitation
 * ------------------------------------------------------------------ */
export async function sendWelcomeNewsletterEmail(email: string) {
  const siteUrl = getFrontendUrl()

  const contentHtml = `
    <h2 style="font-family: 'Times New Roman', Georgia, serif; font-size: 20px; font-weight: 400; margin: 0 0 12px; color: #1a1a1a; text-align: center;">
      Welcome to the Atelier
    </h2>
    <p style="margin: 0 0 20px; color: #666257; text-align: center;">
      Thank you for subscribing to Style Sence. You are now part of our private clientele circle, receiving preview access to curated drops, bespoke tailoring notes, and seasonal editorials.
    </p>
    <div style="background-color: #faf9f5; border: 1px solid #e5e3dc; padding: 24px; text-align: center; margin: 28px 0;">
      <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.28em; color: #888478; margin-bottom: 8px;">Your Welcome Privilege</div>
      <div style="font-family: monospace; font-size: 22px; letter-spacing: 0.15em; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">ATELIER10</div>
      <div style="font-size: 12px; color: #666257;">Enjoy 10% off your inaugural order at checkout</div>
    </div>
    <div style="text-align: center;">
      <a href="${siteUrl}/#/shop" class="button" target="_blank">Explore The Collection</a>
    </div>
  `

  return sendEmail({
    to: email,
    subject: `Welcome to the Style Sence Atelier — Your Privilege Code`,
    html: luxuryEmailLayout('Welcome to Style Sence', 'Your welcome privilege code for Style Sence', contentHtml),
  })
}

/* ------------------------------------------------------------------ *
 * 5. Customer Registration Welcome
 * ------------------------------------------------------------------ */
export async function sendWelcomeCustomerEmail(email: string, name: string) {
  const siteUrl = getFrontendUrl()

  const contentHtml = `
    <h2 style="font-family: 'Times New Roman', Georgia, serif; font-size: 20px; font-weight: 400; margin: 0 0 12px; color: #1a1a1a;">
      Welcome, ${name}
    </h2>
    <p style="margin: 0 0 20px; color: #666257;">
      Your Style Sence client account has been created. From your private portal, you can track orders, save bespoke measurements for precision tailoring, and curate your personal wishlist.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${siteUrl}/#/account" class="button" target="_blank">Access Your Client Portal</a>
    </div>
  `

  return sendEmail({
    to: email,
    subject: `Welcome to Style Sence — Client Account Created`,
    html: luxuryEmailLayout('Welcome to Style Sence', 'Your client account is now active', contentHtml),
  })
}

/* ------------------------------------------------------------------ *
 * Core Dispatch Helper
 * ------------------------------------------------------------------ */
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!resend) {
    console.log(
      `[lib/email] RESEND_API_KEY is not configured. Email to "${to}" with subject "${subject}" simulated.`
    )
    return { success: true, simulated: true }
  }

  try {
    const data = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
    })
    console.log(`[lib/email] Sent email to ${to} (ID: ${data.data?.id})`)
    return { success: true, id: data.data?.id }
  } catch (err: unknown) {
    console.error(`[lib/email] Failed to send email to ${to}:`, err)
    return { success: false, error: err }
  }
}
