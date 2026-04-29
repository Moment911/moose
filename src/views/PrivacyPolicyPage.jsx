"use client"

import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const CO    = 'Koto Health LLC'
const APP   = 'Koto'
const URL   = 'hellokoto.com'
const ADDR  = 'Boca Raton, Florida, United States'
const EMAIL = 'privacy@hellokoto.com'
const DATE  = 'April 29, 2026'
const RED   = '#E6007E'
const BLK = '#111111'
const FH    = "'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB    = "'Raleway','Georgia',serif"

function H1({ children }) {
  return <h1 style={{ fontSize:36, fontWeight:900, color:BLK, margin:'0 0 8px', fontFamily:FH, letterSpacing:'-.03em' }}>{children}</h1>
}
function H2({ id, children }) {
  return <h2 id={id} style={{ fontSize:20, fontWeight:800, color:BLK, margin:'40px 0 12px', fontFamily:FH, paddingTop:8, borderTop:'2px solid #f3f4f6' }}>{children}</h2>
}
function H3({ children }) {
  return <h3 style={{ fontSize:16, fontWeight:700, color:BLK, margin:'20px 0 8px', fontFamily:FH }}>{children}</h3>
}
function P({ children }) {
  return <p style={{ fontSize:15, color:'#374151', lineHeight:1.8, margin:'0 0 14px', fontFamily:FB }}>{children}</p>
}
function Li({ children }) {
  return <li style={{ fontSize:15, color:'#374151', lineHeight:1.8, margin:'0 0 6px', fontFamily:FB }}>{children}</li>
}
function Box({ color='#eff6ff', border='#bfdbfe', children }) {
  return <div style={{ padding:'16px 20px', background:color, borderRadius:12, border:`1px solid ${border}`, margin:'16px 0' }}>{children}</div>
}

export default function PrivacyPolicyPage() {
  const sections = [
    { id:'who',         label:'1. Who We Are' },
    { id:'collect',     label:'2. Information We Collect' },
    { id:'use',         label:'3. How We Use Information' },
    { id:'share',       label:'4. How We Share Information' },
    { id:'communications', label:'5. Marketing & Communications' },
    { id:'sms',         label:'6. SMS & Text Message Policy' },
    { id:'calls',       label:'7. Phone Calls Policy' },
    { id:'cookies',     label:'8. Cookies & Tracking' },
    { id:'thirdparty',  label:'9. Third-Party Services' },
    { id:'retention',   label:'10. Data Retention' },
    { id:'security',    label:'11. Security' },
    { id:'rights',      label:'12. Your Rights' },
    { id:'children',    label:'13. Children\'s Privacy' },
    { id:'california',  label:'14. California Residents (CCPA)' },
    { id:'international', label:'15. International Transfers' },
    { id:'changes',     label:'16. Changes to This Policy' },
    { id:'contact',     label:'17. Contact Us' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:FH }}>
      <PublicNav />
      <div style={{ height:64 }} />

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'48px 24px', display:'grid', gridTemplateColumns:'240px 1fr', gap:48, alignItems:'start' }}>
        <div style={{ position:'sticky', top:80 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Contents</div>
          {sections.map(s => (
            <a key={s.id} href={'#'+s.id} style={{ display:'block', fontSize:13, color:'#6b7280', padding:'5px 0 5px 10px', marginLeft:-10, textDecoration:'none', borderLeft:'2px solid transparent', transition:'all .15s' }}>
              {s.label}
            </a>
          ))}
        </div>

        <div>
          <div style={{ marginBottom:32 }}>
            <H1>Privacy Policy</H1>
            <p style={{ fontSize:14, color:'#9ca3af', margin:'4px 0 0', fontFamily:FB }}>Last updated: {DATE}</p>
          </div>

          <Box color='#eff6ff' border='#bfdbfe'>
            <p style={{ margin:0, fontSize:14, color:'#1e3a8a', fontFamily:FB, lineHeight:1.7 }}>
              This Privacy Policy describes how {CO} ("Koto," "we," "us," or "our") collects, uses, discloses, and otherwise processes personal information about users of {APP} (hellokoto.com) and related services. By using our Services, you agree to the practices described in this Policy.
            </p>
          </Box>

          <H2 id="who">1. Who We Are</H2>
          <P>{CO} is a Florida-based company operating the {APP} SaaS platform for marketing agencies. We act as a "data controller" with respect to information we collect directly from you, and as a "data processor" when we handle your clients' data on your behalf.</P>
          <P>Contact us at: {EMAIL} | {ADDR}</P>

          <H2 id="collect">2. Information We Collect</H2>
          <H3>2.1 Information You Provide</H3>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Account registration:</strong> name, email address, company name, phone number, billing address, password</Li>
            <Li><strong>Payment information:</strong> credit/debit card details processed by Stripe (we do not store card numbers)</Li>
            <Li><strong>Profile information:</strong> agency name, logo, branding preferences, team member information</Li>
            <Li><strong>Client data:</strong> information about your clients that you enter or import into the platform, including names, emails, phone numbers, addresses, business details, and campaign data</Li>
            <Li><strong>Communications:</strong> messages you send to our support team, feedback, and survey responses</Li>
            <Li><strong>Marketing preferences:</strong> your choices about receiving communications from us</Li>
            <Li><strong>Health and fitness data (Koto Trainer):</strong> age, sex, height, weight, fitness goals, training experience, dietary preferences, medical flags, injury history, meal logs, workout logs, body measurements, progress photos, and health screening responses. This data is used exclusively to generate personalized fitness and nutrition guidance.</Li>
          </ul>
          <H3>2.2 Information Collected Automatically</H3>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Usage data:</strong> features used, pages visited, actions taken, time spent, click patterns, searches performed</Li>
            <Li><strong>Device information:</strong> IP address, browser type and version, operating system, device identifiers, screen resolution</Li>
            <Li><strong>Log data:</strong> server logs, error reports, access times, referring URLs</Li>
            <Li><strong>Location data:</strong> approximate location inferred from IP address</Li>
            <Li><strong>Cookies and similar technologies:</strong> see Section 8</Li>
          </ul>
          <H3>2.3 Information from Third Parties</H3>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Google:</strong> when you connect Google Search Console, Analytics, or Business Profile, we access data from those services as authorized by your OAuth permissions</Li>
            <Li><strong>Stripe:</strong> payment status, subscription details, billing history</Li>
            <Li><strong>Google Places API:</strong> business information, reviews, photos, and ratings for businesses you manage</Li>
            <Li><strong>Other integrations:</strong> data from any third-party services you connect to {APP}</Li>
          </ul>

          <H2 id="use">3. How We Use Your Information</H2>
          <P>We use the information we collect for the following purposes:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Providing, operating, maintaining, and improving the Services</Li>
            <Li>Processing payments and managing subscriptions</Li>
            <Li>Creating and managing your account</Li>
            <Li>Sending transactional communications (receipts, account alerts, security notifications)</Li>
            <Li>Sending marketing, promotional, and informational communications (with consent as described in Section 5)</Li>
            <Li>Personalizing your experience and delivering targeted content</Li>
            <Li>Providing AI-powered features and analysis using your data as context</Li>
            <Li>Analyzing usage patterns to improve the platform</Li>
            <Li>Detecting and preventing fraud, abuse, and security incidents</Li>
            <Li>Complying with legal obligations</Li>
            <Li>Enforcing our Terms of Service</Li>
            <Li>Training and improving our AI systems using aggregated, anonymized data</Li>
            <Li>Contacting you about new products, features, and offers from Koto and selected partners</Li>
          </ul>
          <P>Koto reserves the right to use aggregated, de-identified data derived from user activity for any business purpose, including product development, benchmarking, research, and marketing.</P>

          <H2 id="share">4. How We Share Your Information</H2>
          <P>We do not sell your personal information to third parties. We may share your information as follows:</P>
          <H3>4.1 Service Providers</H3>
          <P>We share information with trusted vendors who help us operate the Services, including: Stripe (payments), Anthropic (AI processing), Google (API services), Vercel (hosting), Supabase (database), and email/SMS delivery providers. These vendors are contractually bound to use your data only as directed by us.</P>
          <H3>4.2 Business Transfers</H3>
          <P>If {CO} is acquired, merges with another company, or sells substantially all of its assets, your information may be transferred as part of that transaction. You will be notified via email and/or prominent notice on our platform.</P>
          <H3>4.3 Legal Requirements</H3>
          <P>We may disclose your information if required by law, subpoena, court order, or government request, or if we believe disclosure is necessary to: protect the rights, property, or safety of Koto, our users, or the public; prevent fraud; or enforce our Terms.</P>
          <H3>4.4 With Your Consent</H3>
          <P>We may share information for any other purpose with your explicit consent.</P>
          <H3>4.5 Aggregate Data</H3>
          <P>We may share aggregated, anonymized data that does not identify you individually with partners, advertisers, or the public for research, benchmarking, or marketing purposes.</P>

          <H2 id="communications">5. Marketing & Email Communications</H2>
          <P>By creating an account, you expressly consent to receive marketing communications from Koto. These may include:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Product updates, feature announcements, and newsletters</Li>
            <Li>Promotional offers, discounts, and special events</Li>
            <Li>Educational content, webinars, and industry insights</Li>
            <Li>Surveys, beta invitations, and feedback requests</Li>
            <Li>Offers from carefully selected partners that we believe may interest you</Li>
          </ul>
          <P>You may opt out of marketing emails at any time by clicking the "unsubscribe" link in any marketing email. Transactional emails (billing, security, account notices) cannot be opted out of while your account is active.</P>
          <P>Koto complies with the CAN-SPAM Act. All marketing emails identify the sender, include a valid physical mailing address, and provide a clear method to opt out.</P>

          <H2 id="sms">6. SMS & Text Message Policy</H2>
          <Box color='#f0fdf4' border='#bbf7d0'>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#15803d', fontFamily:FH }}>SMS Consent & Opt-Out</p>
            <p style={{ margin:'6px 0 0', fontSize:14, color:'#166534', fontFamily:FB, lineHeight:1.7 }}>
              By providing your mobile number, you consent to receive text messages from {CO}. Reply STOP to opt out of marketing texts. Reply HELP for help. Message and data rates may apply.
            </p>
          </Box>
          <P>When you provide your mobile phone number, you consent to receive automated and manual SMS and MMS messages from {CO} at the number provided. Message types include:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Account verification and two-factor authentication codes</Li>
            <Li>Billing alerts and payment notifications</Li>
            <Li>Security alerts and suspicious activity warnings</Li>
            <Li>Product announcements and feature updates</Li>
            <Li>Promotional offers and marketing messages</Li>
            <Li>Customer service follow-up</Li>
          </ul>
          <P><strong>Message frequency:</strong> Varies based on your account activity and marketing preferences. You may receive up to 10 messages per month for marketing purposes.</P>
          <P><strong>Opt-out:</strong> Reply STOP to any marketing text to unsubscribe from marketing SMS. You may still receive transactional texts required for account operation. To opt out of all texts, contact {EMAIL}.</P>
          <P><strong>Carriers:</strong> Carriers are not liable for delayed or undelivered messages. {CO} is not liable for any charges or fees incurred from your wireless carrier.</P>
          <P>Koto complies with the Telephone Consumer Protection Act (TCPA) and all applicable SMS marketing regulations.</P>

          <H2 id="calls">7. Phone Call Policy</H2>
          <P>By providing your phone number, you consent to receive calls from {CO}, including:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Account and billing notifications</Li>
            <Li>Onboarding and customer success calls</Li>
            <Li>Sales and marketing calls about our products and services</Li>
            <Li>Automated calls and pre-recorded messages</Li>
            <Li>Calls made using automatic telephone dialing systems (ATDS)</Li>
          </ul>
          <P>You may revoke consent to marketing calls at any time by contacting {EMAIL}. Revocation does not apply retroactively. Koto complies with the TCPA and Do Not Call regulations.</P>

          <H2 id="cookies">8. Cookies & Tracking Technologies</H2>
          <P>We use cookies, pixel tags, web beacons, local storage, and similar technologies to:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Keep you logged in and maintain session state</Li>
            <Li>Remember your preferences and settings</Li>
            <Li>Analyze platform usage and performance</Li>
            <Li>Deliver targeted advertising on third-party platforms</Li>
            <Li>Measure the effectiveness of our marketing campaigns</Li>
            <Li>Detect fraud and improve security</Li>
          </ul>
          <P>We use the following types of cookies: (a) <strong>Essential cookies</strong> required for platform operation; (b) <strong>Analytics cookies</strong> (Google Analytics) to understand usage; (c) <strong>Marketing cookies</strong> for retargeting and advertising; (d) <strong>Preference cookies</strong> to remember your settings.</P>
          <P>You may control cookies through your browser settings. Disabling cookies may impact platform functionality. We honor Global Privacy Control (GPC) signals where required by law.</P>

          <H2 id="thirdparty">9. Third-Party Services & AI Processing</H2>
          <P>Our platform is powered by third-party services including:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Anthropic Claude AI:</strong> your data (including client business information, content, and queries) may be sent to Anthropic's API to generate AI responses. Anthropic's usage policies apply.</Li>
            <Li><strong>Google APIs:</strong> Search Console, Analytics, Business Profile, and Places data is accessed per your OAuth authorization. Google's privacy policy applies.</Li>
            <Li><strong>Stripe:</strong> payment processing. Your card data is transmitted directly to Stripe and not stored by Koto.</Li>
            <Li><strong>Vercel:</strong> cloud hosting and deployment. Your requests pass through Vercel's infrastructure.</Li>
            <Li><strong>Supabase:</strong> database storage of your account and client data.</Li>
          </ul>
          <P>By using these integrations, you consent to your data being processed by these third parties. Koto is not responsible for the privacy practices of third-party providers.</P>

          <H2 id="retention">10. Data Retention</H2>
          <P>We retain your personal information for as long as your account is active or as necessary to provide the Services. Upon account termination:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li>Active account data is retained for 30 days post-termination</Li>
            <Li>You may request a data export within this 30-day window</Li>
            <Li>After 30 days, personal data is deleted or anonymized</Li>
            <Li>Billing and transaction records may be retained for 7 years for legal and tax compliance</Li>
            <Li>Backup copies may persist for up to 90 days in disaster recovery systems</Li>
            <Li>Anonymized, aggregated data may be retained indefinitely</Li>
          </ul>

          <H2 id="security">11. Security</H2>
          <P>We implement commercially reasonable technical and organizational security measures to protect your information, including encryption in transit (TLS/SSL), encrypted database storage, access controls, and regular security reviews. However, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security. You use the Services at your own risk.</P>
          <P>In the event of a data breach that is required to be reported under applicable law, we will notify you as required. Koto's liability for any breach is limited as described in Section 13 of our Terms of Service.</P>

          <H3>11A. Health & Fitness Data Protections</H3>
          <P>Health and fitness data collected through Koto Trainer (including body measurements, medical flags, injury history, dietary information, workout logs, and progress photos) receives additional protections:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>No advertising use:</strong> Health data is never shared with advertising platforms, data brokers, or used for ad targeting</Li>
            <Li><strong>Encryption:</strong> All health data is encrypted at rest and in transit</Li>
            <Li><strong>Access controls:</strong> Health data access is limited to the user and their explicitly authorized coach or trainer</Li>
            <Li><strong>AI processing:</strong> Health data may be processed by AI systems (Anthropic Claude) solely to generate your fitness and nutrition guidance. Our AI vendor agreements prohibit the use of your data for model training without explicit consent</Li>
            <Li><strong>Deletion:</strong> You may request complete deletion of all health data at any time by contacting {EMAIL}</Li>
            <Li><strong>Audit logging:</strong> Access to health data is logged for security and compliance purposes</Li>
          </ul>

          <H2 id="rights">12. Your Rights & Choices</H2>
          <P>Subject to applicable law, you may have the following rights:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Access:</strong> Request a copy of personal data we hold about you</Li>
            <Li><strong>Correction:</strong> Request correction of inaccurate data</Li>
            <Li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</Li>
            <Li><strong>Portability:</strong> Request export of your data in a machine-readable format</Li>
            <Li><strong>Opt-out:</strong> Opt out of marketing emails, SMS, and calls as described above</Li>
            <Li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</Li>
          </ul>
          <P>To exercise these rights, contact {EMAIL}. We will respond within 30 days. We may require verification of your identity before fulfilling requests. Some requests may be subject to limitations based on legal obligations or legitimate business interests.</P>
          <P>We reserve the right to charge a reasonable fee for excessive, repetitive, or clearly unfounded requests.</P>

          <H2 id="children">13. Children's Privacy</H2>
          <P>The Services are not directed to, and we do not knowingly collect personal information from, children under the age of 18. If you believe a child has provided us with personal information, contact us immediately at {EMAIL} and we will delete such information. If you are under 18, do not use the Services.</P>

          <H2 id="california">14. California Residents — CCPA/CPRA Rights</H2>
          <P>California residents have additional rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA):</P>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Right to Know:</strong> categories of personal information collected and disclosed in the past 12 months</Li>
            <Li><strong>Right to Delete:</strong> subject to exceptions for legal compliance and service operation</Li>
            <Li><strong>Right to Correct:</strong> inaccurate personal information</Li>
            <Li><strong>Right to Opt-Out of Sale/Sharing:</strong> we do not sell personal information. We may share data with advertising partners which may constitute "sharing" under CPRA.</Li>
            <Li><strong>Right to Limit Sensitive Personal Information:</strong> use of sensitive data is limited to service operation</Li>
            <Li><strong>Non-Discrimination:</strong> we will not discriminate against you for exercising your rights</Li>
          </ul>
          <P>To submit a California privacy request, email {EMAIL} with "California Privacy Request" in the subject line. We will verify your identity before processing.</P>

          <H2 id="international">15. International Data Transfers</H2>
          <P>Your information is stored and processed in the United States. If you are located outside the United States, you understand that your data will be transferred to, stored in, and processed in the United States, which may have different data protection laws than your country. By using the Services, you consent to this transfer. Where required by applicable law, we implement appropriate safeguards for international data transfers.</P>

          <H2 id="changes">16. Changes to This Privacy Policy</H2>
          <P>We reserve the right to update this Privacy Policy at any time. When we make material changes, we will: (a) update the "Last Updated" date; (b) notify you by email; and/or (c) post a prominent notice on the platform. Your continued use of the Services after any change constitutes acceptance of the revised Policy. We encourage you to review this Policy periodically.</P>
          <P>Koto reserves the right to apply changes to this Policy retroactively to the extent permitted by law.</P>

          <H2 id="contact">17. Contact Us</H2>
          <P>For privacy questions, requests, or complaints:</P>
          <ul style={{ paddingLeft:24 }}>
            <Li><strong>Email:</strong> {EMAIL}</Li>
            <Li><strong>Address:</strong> {CO}, {ADDR}</Li>
            <Li><strong>Website:</strong> {URL}</Li>
          </ul>
          <P>We aim to respond to all inquiries within 30 days.</P>

          <div style={{ marginTop:48, padding:'20px 24px', background:'#f3f4f6', borderRadius:12, fontSize:13, color:'#6b7280', fontFamily:FB, lineHeight:1.7 }}>
            This Privacy Policy was last updated on {DATE}. By using {APP}, you confirm that you have read and understood how we collect and use your information.
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
