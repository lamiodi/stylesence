/**
 * Manual test: sends all 5 email templates to a real inbox via Resend.
 * Usage:  cd backend && npx tsx --env-file=.env scripts/test-emails.ts
 */
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendPasswordResetEmail,
  sendWelcomeNewsletterEmail,
  sendWelcomeCustomerEmail,
  resend,
} from '../lib/email'

const TO = process.argv[2] || 'tygaosibenuah@gmail.com'

async function main() {
  if (!resend) {
    console.error('✗ RESEND_API_KEY is not set — emails would only be simulated. Aborting.')
    process.exit(1)
  }
  console.log(`Sending 5 test emails to ${TO} …\n`)

  // 1. Order confirmation
  const r1 = await sendOrderConfirmationEmail({
    orderNumber: 'TEST-' + Date.now().toString().slice(-6),
    fullName: 'Test Client',
    email: TO,
    phone: '+234 801 234 5678',
    address: '12 Admiralty Way, Lekki Phase 1',
    city: 'Lagos',
    state: 'Lagos — Island',
    shippingMethod: 'express',
    shipping: 0,
    subtotal: 185000,
    discount: 18500,
    total: 166500,
    items: [
      {
        productName: 'Camille Duo — Café',
        size: 'M',
        color: 'Café',
        qty: 1,
        unitPrice: 120000,
        imageUrl:
          'https://res.cloudinary.com/qaruxkhf/image/upload/w_100,q_auto,f_auto/v1790056402/stylesence/products/camille-duo-cafe.jpg',
      },
      {
        productName: 'Camille Skirt — Slate',
        size: 'M',
        color: 'Slate',
        qty: 1,
        unitPrice: 65000,
        imageUrl:
          'https://res.cloudinary.com/qaruxkhf/image/upload/w_100,q_auto,f_auto/v1790056413/stylesence/products/camille-skirt-slate.jpg',
      },
    ],
  })
  console.log('1. Order Confirmation .........', r1)

  // 2. Order status update
  const r2 = await sendOrderStatusUpdateEmail({
    orderNumber: 'TEST-123456',
    fullName: 'Test Client',
    email: TO,
    status: 'SHIPPED',
  })
  console.log('2. Order Status Update .......', r2)

  // 3. Password reset
  const r3 = await sendPasswordResetEmail(
    TO,
    'http://localhost:3000/#/reset-password?token=test-token-abc123'
  )
  console.log('3. Password Reset ............', r3)

  // 4. Newsletter welcome
  const r4 = await sendWelcomeNewsletterEmail(TO)
  console.log('4. Newsletter Welcome ........', r4)

  // 5. Customer registration welcome
  const r5 = await sendWelcomeCustomerEmail(TO, 'Test Client')
  console.log('5. Customer Welcome ..........', r5)

  const results = [r1, r2, r3, r4, r5]
  const ok = results.filter((r) => r.success).length
  console.log(`\nDone: ${ok}/5 succeeded. Check the inbox (and spam folder) at ${TO}.`)
  process.exit(ok === 5 ? 0 : 1)
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
