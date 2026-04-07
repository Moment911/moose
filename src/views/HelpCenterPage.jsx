"use client"
import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, ChevronRight, MessageSquare, Sparkles, Loader2, Send, X, HelpCircle, BookOpen, Globe, Target, Star, BarChart2, CreditCard, AlertCircle, Zap, FileText, Settings } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { callClaude } from '../lib/ai'
import toast from 'react-hot-toast'
import { useMobile } from '../hooks/useMobile'
import { MobilePage, MobilePageHeader } from '../components/mobile/MobilePage'

const R='#ea2729',T='#5bc6d0',BLK='#0a0a0a',GRY='#f2f2f0',GRN='#16a34a',AMB='#f59e0b'
const FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB="'Raleway','Helvetica Neue',sans-serif"

const KOTO_SYSTEM_PROMPT = `You are the Koto Help Center AI assistant. Koto is an AI-powered marketing agency platform that helps digital agencies manage clients, generate SEO content, handle reviews, find leads, and optimize performance marketing.

Key features you should know about:
- **WordPress SEO Page Generation**: The Page Builder uses a wildcard system with variables like {city}, {state}, {service}, {zip}, {county}, and {neighborhood} to generate geo-targeted landing pages at scale. Pages include AEO (Answer Engine Optimization) and schema markup.
- **Review Management**: Agencies can monitor, respond to, and generate review campaigns for clients. AI-powered response generation crafts professional replies. Review widgets can be embedded on client websites.
- **Scout Lead Generation**: Uses Google Places API integration to find and score potential leads based on their online presence, review count, website quality, and local SEO gaps. Leads are scored and fed into a pipeline.
- **Performance Marketing AI**: Optimizes ad campaigns across platforms with AI-driven recommendations for budget allocation, bid adjustments, and audience targeting.
- **KotoDesk Support Ticketing**: Built-in helpdesk system for agencies to manage client support tickets with SLA tracking, priority levels, and team assignment.
- **Page Builder**: Features 11 content modules (Hero, FAQ, Services, Testimonials, CTA, Stats, Team, Gallery, Map, Contact, Custom HTML) with GPT-4 powered research for content generation.
- **Client Onboarding**: Shareable onboarding links that collect business info, brand guidelines, access credentials, and service preferences from new clients.
- **Document Vault**: Secure per-client document storage for contracts, brand assets, reports, and deliverables.
- **Proposals**: Create professional proposals with itemized services, pricing tiers, and e-signature collection for client approval.
- **Debug Console**: Health monitoring dashboard showing WordPress connection status, API health, build queue status, and error logs.
- **WordPress Plugin**: koto-seo-v3 connects client WordPress sites to the agency dashboard. It receives generated pages, handles publishing, manages schema markup, and syncs content updates.
- **Tech Stack**: Supabase for database and auth, Vercel for hosting, Anthropic Claude + OpenAI GPT-4 for AI features.

Answer questions helpfully and concisely. If you don't know something specific, suggest the user contact support at support@koto.agency. Always be friendly and professional.`

const FAQ_CATEGORIES = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: BookOpen,
    color: T,
    questions: [
      { q: 'What is Koto and who is it for?', a: 'Koto is an AI-powered marketing agency platform designed for digital marketing agencies of all sizes. It provides tools for SEO page generation, review management, lead generation, client onboarding, and performance marketing — all in one unified dashboard.', related: ['How do I create my agency account?', 'What plans are available?'] },
      { q: 'How do I create my agency account?', a: 'Click "Get Started" on the Koto homepage and fill out your agency name, email, and password. You will receive a confirmation email to verify your account. Once verified, you can begin the agency setup wizard which walks you through branding, team invites, and your first client.', related: ['How do I add my first client?', 'Can I invite team members?'] },
      { q: 'How do I add my first client?', a: 'Navigate to the Clients section from the sidebar and click "Add Client." Enter the client\'s business name, website URL, and primary contact info. You can also send them a shareable onboarding link that collects all their business details automatically.', related: ['What is client onboarding?', 'How do I connect a client\'s WordPress site?'] },
      { q: 'What is client onboarding?', a: 'Client onboarding is a shareable form link you send to new clients. They fill out their business information, brand guidelines, login credentials, and service preferences. All data is stored securely and populates their client profile automatically, saving you hours of manual data entry.', related: ['How do I add my first client?', 'Where are client documents stored?'] },
      { q: 'Can I invite team members?', a: 'Yes, go to Agency Settings and click "Invite Team Member." Enter their email and assign a role (Admin, Manager, or Member). Each role has different permission levels. Team seats are included based on your subscription plan.', related: ['What plans are available?', 'How do I manage team permissions?'] },
      { q: 'How do I manage team permissions?', a: 'Under Agency Settings > Team, you can view all members and their roles. Admins have full access, Managers can manage clients and content but not billing, and Members have read/edit access to assigned clients only. Click any member to change their role.', related: ['Can I invite team members?', 'What is the agency setup wizard?'] },
      { q: 'What is the agency setup wizard?', a: 'The setup wizard guides you through initial configuration when you first create your agency. It covers uploading your logo, setting brand colors, configuring your agency domain, inviting your first team member, and adding your first client. You can skip steps and complete them later.', related: ['How do I create my agency account?', 'How do I customize my agency branding?'] },
      { q: 'How do I customize my agency branding?', a: 'Go to Agency Settings > Branding to upload your logo, set primary and secondary colors, choose fonts, and add your tagline. These settings are applied to the client portal, proposals, and exported reports to maintain your agency\'s brand identity.', related: ['What is the agency setup wizard?', 'Can I white-label the client portal?'] },
      { q: 'Can I white-label the client portal?', a: 'Yes, on Growth and Agency plans, you can fully white-label the client portal with your agency branding, custom domain, and logo. Clients will see your brand throughout their experience with no Koto branding visible.', related: ['What plans are available?', 'How do I customize my agency branding?'] },
      { q: 'Where can I find the Koto documentation?', a: 'Documentation is available in this Help Center, through the AI chat assistant above, and in contextual tooltips throughout the platform. For developer documentation on the WordPress plugin and API, visit docs.koto.agency.', related: ['What is Koto and who is it for?', 'How do I contact support?'] },
    ]
  },
  {
    id: 'page-builder',
    label: 'Page Builder',
    icon: Sparkles,
    color: '#8b5cf6',
    questions: [
      { q: 'What are wildcards and how do they work?', a: 'Wildcards are dynamic variables like {city}, {state}, {service}, {zip}, {county}, and {neighborhood} that get replaced with real data when pages are generated. For example, a template titled "{service} in {city}, {state}" could generate hundreds of unique geo-targeted pages like "Plumbing in Austin, Texas."', related: ['How many wildcards can I use?', 'How do I create a page template?'] },
      { q: 'How many wildcards can I use?', a: 'You can use up to 6 wildcard types simultaneously in a single template. The system supports {city}, {state}, {service}, {zip}, {county}, and {neighborhood}. You can upload CSV files with your wildcard data or use our built-in location database for US cities and states.', related: ['What are wildcards and how do they work?', 'Can I import wildcard data from a CSV?'] },
      { q: 'Can I import wildcard data from a CSV?', a: 'Yes, go to the Page Builder and click "Import Data." Upload a CSV with columns matching your wildcard names (e.g., city, state, service). The system validates the data and shows a preview before import. You can also edit individual entries after import.', related: ['How many wildcards can I use?', 'How do I create a page template?'] },
      { q: 'How do I create a page template?', a: 'In the Page Builder, click "New Template" and choose from 11 content modules: Hero, FAQ, Services, Testimonials, CTA, Stats, Team, Gallery, Map, Contact, and Custom HTML. Drag and drop modules to arrange them, then add your content with wildcards. Use the GPT-4 Research button to auto-generate content.', related: ['What are the 11 content modules?', 'How does GPT-4 research work?'] },
      { q: 'What are the 11 content modules?', a: 'The modules are: Hero (main banner with headline and CTA), FAQ (accordion-style Q&As), Services (grid of service cards), Testimonials (customer reviews carousel), CTA (call-to-action banner), Stats (number counters), Team (staff bios), Gallery (image grid), Map (embedded Google Map), Contact (form), and Custom HTML (raw code).', related: ['How do I create a page template?', 'Can I reorder modules?'] },
      { q: 'How does GPT-4 research work?', a: 'When building page content, click the "Research" button on any module. GPT-4 analyzes the client\'s industry, target location, and service to generate relevant, SEO-optimized content. It pulls from its training data to create unique paragraphs, FAQs, and service descriptions tailored to each wildcard combination.', related: ['How do I create a page template?', 'Does Koto handle AEO optimization?'] },
      { q: 'Does Koto handle AEO optimization?', a: 'Yes, all generated pages include Answer Engine Optimization (AEO) structured data. This means content is formatted to appear in AI-generated search results and featured snippets. The system automatically adds FAQ schema, LocalBusiness schema, and Service schema markup.', related: ['How does GPT-4 research work?', 'How do I deploy pages to WordPress?'] },
      { q: 'How do I deploy pages to WordPress?', a: 'After building your template, click "Generate & Deploy." Select the target WordPress site (must have koto-seo-v3 plugin installed), choose your wildcard data set, and click Deploy. Pages are queued and published in batches to avoid server overload. You can monitor progress in the build queue.', related: ['What is the koto-seo-v3 plugin?', 'Can I preview pages before publishing?'] },
      { q: 'Can I preview pages before publishing?', a: 'Yes, the Page Builder has a live preview mode that shows exactly how each page will look with wildcard data filled in. You can cycle through different wildcard combinations using the preview dropdown. Pages can also be deployed as drafts in WordPress for review before publishing.', related: ['How do I deploy pages to WordPress?', 'Can I edit pages after deployment?'] },
      { q: 'Can I edit pages after deployment?', a: 'Yes, you can edit the template in Koto and re-deploy to update all generated pages at once, or edit individual pages directly in WordPress. Changes made in Koto will sync to WordPress on the next deployment. The koto-seo-v3 plugin handles content updates seamlessly.', related: ['Can I preview pages before publishing?', 'How do I deploy pages to WordPress?'] },
    ]
  },
  {
    id: 'wordpress-plugin',
    label: 'WordPress Plugin',
    icon: Globe,
    color: '#2563eb',
    questions: [
      { q: 'What is the koto-seo-v3 plugin?', a: 'koto-seo-v3 is the official Koto WordPress plugin that connects your client\'s WordPress site to the Koto agency dashboard. It receives generated pages, handles publishing and updates, manages schema markup, and provides a local health check endpoint for the Debug Console.', related: ['How do I install the WordPress plugin?', 'How do I connect WordPress to Koto?'] },
      { q: 'How do I install the WordPress plugin?', a: 'Download the koto-seo-v3.zip file from your Koto dashboard under Settings > WordPress Plugin. In WordPress, go to Plugins > Add New > Upload Plugin and select the zip file. Activate the plugin, then enter your Koto API key in the plugin settings page.', related: ['What is the koto-seo-v3 plugin?', 'Where do I find my API key?'] },
      { q: 'Where do I find my API key?', a: 'Your API key is located in Koto under Agency Settings > Integrations > WordPress. Each client site gets a unique API key. Click "Generate Key" next to the client\'s name, then copy and paste it into the WordPress plugin settings on their site.', related: ['How do I install the WordPress plugin?', 'How do I connect WordPress to Koto?'] },
      { q: 'How do I connect WordPress to Koto?', a: 'After installing koto-seo-v3 and entering the API key, go to the plugin settings and click "Test Connection." A green checkmark means the connection is active. You can also verify from the Koto dashboard under the client\'s WordPress tab — it will show the site URL and connection status.', related: ['Where do I find my API key?', 'Why is my WordPress connection failing?'] },
      { q: 'Does the plugin affect site performance?', a: 'No, koto-seo-v3 is lightweight and only activates when receiving content from Koto or serving schema markup. It adds no frontend JavaScript and does not load on regular page views. Generated pages are saved as standard WordPress posts/pages with no plugin dependency for rendering.', related: ['What is the koto-seo-v3 plugin?', 'How do generated pages appear in WordPress?'] },
      { q: 'How do generated pages appear in WordPress?', a: 'Generated pages are created as standard WordPress pages (or posts, depending on your settings) with proper titles, slugs, meta descriptions, and schema markup. They use your active WordPress theme\'s page template and are fully editable in the WordPress editor.', related: ['Does the plugin affect site performance?', 'Can I edit pages after deployment?'] },
      { q: 'Can I use the plugin on multiple sites?', a: 'Yes, each client WordPress site gets its own API key and plugin installation. There is no limit to the number of sites you can connect. The Koto dashboard shows all connected sites with their status, last sync time, and page counts.', related: ['Where do I find my API key?', 'How do I connect WordPress to Koto?'] },
      { q: 'How do I update the plugin?', a: 'Plugin updates are distributed through the Koto dashboard. When a new version is available, you will see a notification in both Koto and the WordPress admin. Download the new zip and upload it, or use the one-click update button if your server supports it.', related: ['What is the koto-seo-v3 plugin?', 'How do I install the WordPress plugin?'] },
    ]
  },
  {
    id: 'reviews',
    label: 'Reviews',
    icon: Star,
    color: AMB,
    questions: [
      { q: 'How does review management work?', a: 'Koto aggregates reviews from Google Business Profile and other platforms into a single dashboard per client. You can view all reviews, filter by rating or date, and respond directly from Koto. The AI response generator crafts professional replies in seconds that you can edit before posting.', related: ['How does AI review response work?', 'Can I set up review campaigns?'] },
      { q: 'How does AI review response work?', a: 'Click "Generate Response" on any review to have Claude AI craft a professional, empathetic reply. The AI considers the review sentiment, star rating, and specific mentions to create a personalized response. You can adjust the tone (formal, friendly, apologetic) and edit before publishing.', related: ['How does review management work?', 'Can I customize response templates?'] },
      { q: 'Can I customize response templates?', a: 'Yes, go to Reviews > Settings > Templates to create response templates for common scenarios like positive reviews, negative reviews, and neutral reviews. Templates can include variables like {customer_name} and {business_name}. The AI uses these templates as a starting point when generating responses.', related: ['How does AI review response work?', 'How do review widgets work?'] },
      { q: 'How do review widgets work?', a: 'Review widgets are embeddable components you can add to client websites. Go to Reviews > Widgets to configure the style, filter criteria (minimum stars, keywords), and layout (carousel, grid, or list). Copy the embed code and paste it into the client\'s website HTML or use the WordPress shortcode.', related: ['Can I customize response templates?', 'How does review management work?'] },
      { q: 'Can I set up review campaigns?', a: 'Yes, review campaigns send automated email or SMS requests to a client\'s customers asking them to leave a review. Upload a customer list or connect to the client\'s CRM, set the timing and frequency, and customize the message. Campaigns include a smart link that routes happy customers to Google and unhappy ones to a private feedback form.', related: ['How does review management work?', 'What review analytics are available?'] },
      { q: 'What review analytics are available?', a: 'The Reviews dashboard shows total review count, average rating over time, response rate, sentiment trends, and review velocity charts. You can compare performance across time periods and benchmark against competitors. Monthly reports can be auto-generated and sent to clients.', related: ['Can I set up review campaigns?', 'How does review management work?'] },
      { q: 'How do I connect Google Business Profile?', a: 'Under the client\'s Reviews tab, click "Connect Google" and sign in with the Google account that manages the business listing. Authorize Koto to read and respond to reviews. Once connected, reviews sync automatically every hour and you will receive notifications for new reviews.', related: ['How does review management work?', 'What review analytics are available?'] },
      { q: 'Can I manage reviews for multiple locations?', a: 'Yes, each client can have multiple business locations linked to their profile. Reviews from all locations are aggregated in the client\'s review dashboard, but you can filter by individual location. Each location can have its own response templates and campaign settings.', related: ['How do I connect Google Business Profile?', 'How does review management work?'] },
    ]
  },
  {
    id: 'scout',
    label: 'Scout',
    icon: Target,
    color: GRN,
    questions: [
      { q: 'What is Scout lead generation?', a: 'Scout is Koto\'s built-in lead generation tool that uses the Google Places API to find businesses in any area and industry. It analyzes their online presence — website quality, review count, SEO performance, and social media — to score each lead and identify businesses that need your agency\'s services.', related: ['How does Scout scoring work?', 'How do I run a Scout search?'] },
      { q: 'How do I run a Scout search?', a: 'Go to Scout and enter a business category (e.g., "plumber"), location (city or zip code), and search radius. Click "Search" and Scout queries Google Places to find matching businesses. Results include business name, address, phone, website, rating, and review count. Each lead is automatically scored.', related: ['What is Scout lead generation?', 'How does Scout scoring work?'] },
      { q: 'How does Scout scoring work?', a: 'Scout scores leads from 0-100 based on multiple factors: website quality (mobile responsiveness, load speed, SSL), Google review count and average rating, social media presence, and local SEO signals. Lower scores indicate businesses with more gaps in their online presence — making them better prospects for your services.', related: ['How do I run a Scout search?', 'Can I customize scoring criteria?'] },
      { q: 'Can I customize scoring criteria?', a: 'Yes, under Scout > Settings you can adjust the weight of each scoring factor. For example, if your agency specializes in review management, you can increase the weight of the review count factor. You can also set minimum thresholds to auto-filter leads that don\'t meet your criteria.', related: ['How does Scout scoring work?', 'How do I manage the Scout pipeline?'] },
      { q: 'How do I manage the Scout pipeline?', a: 'Leads from Scout searches are added to a kanban-style pipeline with stages: New, Contacted, Qualified, Proposal Sent, and Won/Lost. Drag leads between stages, add notes, schedule follow-ups, and track conversion rates. The pipeline integrates with the Proposals feature for seamless deal flow.', related: ['Can I customize scoring criteria?', 'Can I export Scout leads?'] },
      { q: 'Can I export Scout leads?', a: 'Yes, select leads from your search results or pipeline and click "Export." You can export to CSV with all available data fields including name, address, phone, email (when available), website, rating, review count, and Scout score. Exports are useful for mail merge campaigns or CRM imports.', related: ['How do I manage the Scout pipeline?', 'How do I run a Scout search?'] },
      { q: 'How many Scout searches can I run?', a: 'Search limits depend on your plan. Starter includes 500 searches per month, Growth includes 2,000, and Agency includes unlimited searches. Each search query counts as one search regardless of the number of results returned. You can view your usage in Agency Settings > Usage.', related: ['What is Scout lead generation?', 'What plans are available?'] },
      { q: 'Does Scout find email addresses?', a: 'Scout captures publicly available contact information from Google Places listings, which sometimes includes email addresses. For businesses without a public email, Scout shows the website URL and phone number. You can use the website URL to find contact information manually or through third-party enrichment tools.', related: ['How do I run a Scout search?', 'Can I export Scout leads?'] },
    ]
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    color: '#7c3aed',
    questions: [
      { q: 'What plans are available?', a: 'Koto offers three plans: Starter ($297/mo) with up to 25 clients and 3 team seats, Growth ($497/mo) with up to 100 clients and 10 team seats, and Agency ($997/mo) with unlimited clients and seats. All plans include core features; higher tiers unlock advanced features like white-labeling, API access, and priority support.', related: ['How do I upgrade my plan?', 'Is there a free trial?'] },
      { q: 'Is there a free trial?', a: 'Yes, all new accounts start with a 14-day free trial of the Growth plan. No credit card is required to start. You get full access to all Growth features during the trial. At the end of the trial, you can choose any plan or your account will be paused until you subscribe.', related: ['What plans are available?', 'How do I upgrade my plan?'] },
      { q: 'How do I upgrade my plan?', a: 'Go to Agency Settings > Billing and click "Change Plan." Select your desired plan and confirm. Upgrades take effect immediately and you will be prorated for the remainder of your current billing cycle. Downgrades take effect at the start of your next billing cycle.', related: ['What plans are available?', 'How do I update my payment method?'] },
      { q: 'How do I update my payment method?', a: 'Navigate to Agency Settings > Billing and click "Manage Payment Method." You can add or update a credit card through our secure Stripe-powered payment portal. We accept all major credit cards including Visa, Mastercard, and American Express.', related: ['How do I upgrade my plan?', 'How do I view my invoices?'] },
      { q: 'How do I view my invoices?', a: 'All invoices are available under Agency Settings > Billing > Invoice History. Each invoice shows the billing period, plan, amount, and payment status. Click any invoice to download a PDF. Invoices are also emailed to the billing contact on file when payment is processed.', related: ['How do I update my payment method?', 'Can I cancel my subscription?'] },
      { q: 'Can I cancel my subscription?', a: 'Yes, go to Agency Settings > Billing and click "Cancel Subscription." Your account remains active until the end of your current billing period. You can reactivate anytime before the period ends. After cancellation, your data is retained for 90 days in case you decide to come back.', related: ['How do I view my invoices?', 'What happens when I cancel?'] },
      { q: 'What happens when I cancel?', a: 'When you cancel, you retain access until the end of your billing period. After that, your dashboard becomes read-only — you can still export data but cannot create new content or manage clients. Your WordPress pages remain live. After 90 days, your account data is permanently deleted.', related: ['Can I cancel my subscription?', 'What plans are available?'] },
      { q: 'Do you offer annual billing?', a: 'Yes, annual billing is available at a 20% discount. Starter is $237/mo billed annually, Growth is $397/mo billed annually, and Agency is $797/mo billed annually. Contact sales@koto.agency to switch to annual billing or set it up when choosing your plan.', related: ['What plans are available?', 'How do I upgrade my plan?'] },
    ]
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: AlertCircle,
    color: R,
    questions: [
      { q: 'Why is my WordPress connection failing?', a: 'Check that the koto-seo-v3 plugin is activated and the API key is correctly entered with no extra spaces. Ensure your WordPress site is publicly accessible (not behind a maintenance mode plugin or IP restriction). Try regenerating the API key in Koto and entering the new one in WordPress.', related: ['How do I connect WordPress to Koto?', 'Where do I find my API key?'] },
      { q: 'Why are my pages not generating?', a: 'Page generation can fail if your wildcard data has empty rows, if the WordPress connection is down, or if you have exceeded your plan\'s page limit. Check the build queue in Page Builder for error messages. Also verify that your wildcard CSV columns match the variables used in your template.', related: ['How do I deploy pages to WordPress?', 'What are wildcards and how do they work?'] },
      { q: 'Why is the AI not responding?', a: 'AI features require an active internet connection and a valid subscription. If Claude or GPT-4 is timing out, it may be a temporary service disruption — wait a few minutes and try again. Check the Debug Console for API health status. Clear your browser cache if the issue persists.', related: ['How does GPT-4 research work?', 'How does AI review response work?'] },
      { q: 'How do I use the Debug Console?', a: 'The Debug Console is accessible from the sidebar under Tools > Debug. It shows real-time health checks for WordPress connections, API status (Claude, GPT-4, Google Places), build queue status, and recent error logs. Green checkmarks indicate healthy services; red alerts need attention.', related: ['Why is my WordPress connection failing?', 'Why are my pages not generating?'] },
      { q: 'Why are reviews not syncing?', a: 'Review sync requires an active Google Business Profile connection. Go to the client\'s Reviews tab and check the connection status. If it shows "Disconnected," re-authorize the Google account. Reviews sync every hour; you can click "Sync Now" to force an immediate sync.', related: ['How do I connect Google Business Profile?', 'How does review management work?'] },
      { q: 'My client portal link is not working', a: 'Verify the client has an active status in your client list. Expired or paused clients cannot access the portal. Check that the portal link has not been regenerated — each regeneration invalidates the previous link. If using a custom domain, ensure DNS settings are configured correctly.', related: ['Can I white-label the client portal?', 'How do I add my first client?'] },
      { q: 'Pages are showing wrong wildcard data', a: 'This usually means the wildcard data CSV has mismatched columns or duplicate entries. Go to Page Builder > Data and review your imported dataset. Ensure column headers match exactly (city, state, service, etc.) with no typos. Delete and re-import the data if needed.', related: ['What are wildcards and how do they work?', 'Can I import wildcard data from a CSV?'] },
      { q: 'How do I contact support?', a: 'You can reach Koto support through KotoDesk (the built-in ticketing system), by emailing support@koto.agency, or through the AI chat assistant in this Help Center. Growth and Agency plan users receive priority support with faster response times. Support hours are Monday-Friday 9am-6pm EST.', related: ['How do I use the Debug Console?', 'What plans are available?'] },
      { q: 'Scout search returns no results', a: 'Ensure your search category matches a valid Google Places business type (e.g., "plumber" not "plumbing services"). Increase your search radius if searching a small area. Check that you have remaining Scout searches for the month under Agency Settings > Usage. Some rural areas may have limited Google Places coverage.', related: ['How do I run a Scout search?', 'How many Scout searches can I run?'] },
      { q: 'Build queue is stuck or not processing', a: 'A stuck build queue can occur if the WordPress site is unresponsive or rate-limited. Check the Debug Console for the specific error. Try canceling the stuck build and re-queuing it. If the issue persists, verify your WordPress hosting can handle the number of concurrent page creations — some shared hosts have strict limits.', related: ['Why are my pages not generating?', 'How do I use the Debug Console?'] },
    ]
  }
]

const POPULAR_QUESTIONS = [
  'How do I connect WordPress?',
  'What are wildcards?',
  'How does Scout scoring work?',
  'How to manage reviews?',
  'Page Builder tutorial'
]

function TypingText({ text, onComplete }) {
  const [displayed, setDisplayed] = useState('')
  const idx = useRef(0)

  useEffect(() => {
    if (!text) return
    setDisplayed('')
    idx.current = 0
    const chunkSize = 3
    const iv = setInterval(() => {
      idx.current += chunkSize
      if (idx.current >= text.length) {
        setDisplayed(text)
        clearInterval(iv)
        onComplete?.()
      } else {
        setDisplayed(text.slice(0, idx.current))
      }
    }, 15)
    return () => clearInterval(iv)
  }, [text])

  return <span>{displayed}</span>
}

export default function HelpCenterPage() {
  const { user } = useAuth()
  const isMobile = useMobile()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [openQuestion, setOpenQuestion] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [typingIdx, setTypingIdx] = useState(-1)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, typingIdx])

  const handleAsk = async () => {
    const q = chatInput.trim()
    if (!q || chatLoading) return
    setChatInput('')
    setChatHistory(prev => [...prev, { role: 'user', content: q }])
    setChatLoading(true)
    try {
      const resp = await callClaude(q, KOTO_SYSTEM_PROMPT)
      const answer = typeof resp === 'string' ? resp : resp?.content || resp?.text || 'Sorry, I could not generate a response. Please try again.'
      setChatHistory(prev => [...prev, { role: 'ai', content: answer }])
      setTypingIdx(chatHistory.length + 1)
    } catch (e) {
      toast.error('AI assistant is temporarily unavailable')
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again or browse the FAQ below for common questions.' }])
      setTypingIdx(chatHistory.length + 1)
    } finally {
      setChatLoading(false)
    }
  }

  const handlePopularClick = (q) => {
    const searchMap = {
      'How do I connect WordPress?': 'connect WordPress',
      'What are wildcards?': 'wildcards',
      'How does Scout scoring work?': 'Scout scoring',
      'How to manage reviews?': 'review management',
      'Page Builder tutorial': 'Page Builder'
    }
    setSearch(searchMap[q] || q)
    setActiveCategory('all')
  }

  const handleRelatedClick = (q) => {
    for (const cat of FAQ_CATEGORIES) {
      for (let i = 0; i < cat.questions.length; i++) {
        if (cat.questions[i].q === q) {
          setOpenQuestion(`${cat.id}-${i}`)
          setActiveCategory('all')
          setSearch('')
          return
        }
      }
    }
  }

  const filteredCategories = FAQ_CATEGORIES
    .filter(cat => activeCategory === 'all' || cat.id === activeCategory)
    .map(cat => {
      if (!search.trim()) return cat
      const lc = search.toLowerCase()
      const filtered = cat.questions.filter(
        fq => fq.q.toLowerCase().includes(lc) || fq.a.toLowerCase().includes(lc)
      )
      return { ...cat, questions: filtered }
    })
    .filter(cat => cat.questions.length > 0)

  const totalResults = filteredCategories.reduce((s, c) => s + c.questions.length, 0)

  const content = (
    <div style={{ fontFamily: FB, color: BLK, minHeight: '100vh', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: isMobile ? '24px 16px' : '32px 40px', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <HelpCircle size={28} color={T} />
          <h1 style={{ fontFamily: FH, fontSize: isMobile ? 24 : 30, fontWeight: 700, margin: 0 }}>Help Center</h1>
        </div>
        <p style={{ color: '#666', margin: 0, fontSize: 15 }}>
          Find answers, get AI assistance, and learn how to get the most out of Koto.
        </p>

        {/* Search bar */}
        <div style={{ position: 'relative', marginTop: 20, maxWidth: 600 }}>
          <Search size={18} color='#999' style={{ position: 'absolute', left: 14, top: 13 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search all questions..."
            style={{
              width: '100%', padding: '12px 40px 12px 42px', fontSize: 15, border: '1px solid #ddd',
              borderRadius: 10, outline: 'none', fontFamily: FB, background: GRY,
              boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = T}
            onBlur={e => e.target.style.borderColor = '#ddd'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 12, top: 12, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0
            }}>
              <X size={18} color='#999' />
            </button>
          )}
        </div>
        {search && (
          <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
            {totalResults} result{totalResults !== 1 ? 's' : ''} for "{search}"
          </p>
        )}
      </div>

      <div style={{ padding: isMobile ? '20px 16px' : '28px 40px', maxWidth: 900 }}>
        {/* AI Chat Interface */}
        <div style={{
          background: GRY, borderRadius: 14, padding: isMobile ? 16 : 24, marginBottom: 28,
          border: '1px solid #e5e5e5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T}, #8b5cf6)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MessageSquare size={16} color='#fff' />
            </div>
            <div>
              <h3 style={{ fontFamily: FH, fontSize: 16, fontWeight: 700, margin: 0 }}>Ask AI Assistant</h3>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Powered by Claude — ask anything about Koto</p>
            </div>
          </div>

          {/* Chat history */}
          {chatHistory.length > 0 && (
            <div style={{
              maxHeight: 360, overflowY: 'auto', marginBottom: 16, display: 'flex',
              flexDirection: 'column', gap: 12
            }}>
              {chatHistory.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                    background: msg.role === 'user' ? BLK : '#fff',
                    color: msg.role === 'user' ? '#fff' : BLK,
                    fontSize: 14, lineHeight: 1.6, position: 'relative',
                    border: msg.role === 'ai' ? '1px solid #e0e0e0' : 'none'
                  }}>
                    {msg.role === 'ai' && (
                      <span style={{
                        display: 'inline-block', background: `linear-gradient(135deg, ${T}, #8b5cf6)`,
                        color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        marginBottom: 6, marginRight: 4
                      }}>AI</span>
                    )}
                    {msg.role === 'ai' && i === typingIdx ? (
                      <TypingText text={msg.content} onComplete={() => setTypingIdx(-1)} />
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: 12, background: '#fff',
                    border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 13, color: '#888' }}>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask a question about Koto..."
              style={{
                flex: 1, padding: '10px 14px', fontSize: 14, border: '1px solid #ddd',
                borderRadius: 10, outline: 'none', fontFamily: FB, background: '#fff',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = T}
              onBlur={e => e.target.style.borderColor = '#ddd'}
            />
            <button onClick={handleAsk} disabled={chatLoading || !chatInput.trim()} style={{
              padding: '10px 18px', borderRadius: 10, border: 'none', fontFamily: FH,
              fontWeight: 600, fontSize: 14, cursor: chatLoading ? 'not-allowed' : 'pointer',
              background: chatLoading ? '#ccc' : BLK, color: '#fff',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
            }}>
              {chatLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              Ask AI
            </button>
          </div>
        </div>

        {/* Popular questions chips */}
        {!search && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontFamily: FH, fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Popular Questions
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_QUESTIONS.map(q => (
                <button key={q} onClick={() => handlePopularClick(q)} style={{
                  padding: '7px 14px', borderRadius: 20, border: '1px solid #ddd', background: '#fff',
                  fontSize: 13, cursor: 'pointer', fontFamily: FB, color: BLK, transition: 'all 0.15s'
                }}
                  onMouseEnter={e => { e.target.style.borderColor = T; e.target.style.background = '#f0fbfc' }}
                  onMouseLeave={e => { e.target.style.borderColor = '#ddd'; e.target.style.background = '#fff' }}
                >
                  <Zap size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} color={AMB} />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => { setActiveCategory('all'); setOpenQuestion(null) }}
            style={{
              padding: '7px 16px', borderRadius: 20, border: activeCategory === 'all' ? `2px solid ${BLK}` : '1px solid #ddd',
              background: activeCategory === 'all' ? BLK : '#fff', color: activeCategory === 'all' ? '#fff' : BLK,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FH
            }}
          >
            All
          </button>
          {FAQ_CATEGORIES.map(cat => {
            const Icon = cat.icon
            const active = activeCategory === cat.id
            return (
              <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setOpenQuestion(null) }} style={{
                padding: '7px 14px', borderRadius: 20,
                border: active ? `2px solid ${cat.color}` : '1px solid #ddd',
                background: active ? cat.color : '#fff',
                color: active ? '#fff' : BLK,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FH,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Icon size={14} />
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* FAQ Accordions */}
        {filteredCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
            <HelpCircle size={48} color='#ddd' style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 600 }}>No results found</p>
            <p style={{ fontSize: 14 }}>Try a different search term or ask the AI assistant above.</p>
          </div>
        ) : (
          filteredCategories.map(cat => {
            const Icon = cat.icon
            return (
              <div key={cat.id} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, background: cat.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={15} color={cat.color} />
                  </div>
                  <h3 style={{ fontFamily: FH, fontSize: 17, fontWeight: 700, margin: 0 }}>{cat.label}</h3>
                  <span style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>
                    {cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {cat.questions.map((fq, i) => {
                    const key = `${cat.id}-${i}`
                    const isOpen = openQuestion === key
                    return (
                      <div key={key} style={{
                        border: '1px solid #e8e8e8', borderRadius: 10,
                        overflow: 'hidden', background: isOpen ? '#fafafa' : '#fff',
                        transition: 'all 0.15s'
                      }}>
                        <button
                          onClick={() => setOpenQuestion(isOpen ? null : key)}
                          style={{
                            width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                            textAlign: 'left', fontFamily: FB, fontSize: 14, fontWeight: 600,
                            color: BLK
                          }}
                        >
                          {isOpen
                            ? <ChevronDown size={16} color={cat.color} />
                            : <ChevronRight size={16} color='#bbb' />
                          }
                          <span style={{ flex: 1 }}>{fq.q}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0 16px 16px 42px' }}>
                            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#555', margin: '0 0 12px 0' }}>
                              {fq.a}
                            </p>
                            {fq.related && fq.related.length > 0 && (
                              <div>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Related Questions
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {fq.related.map(rq => (
                                    <button
                                      key={rq}
                                      onClick={() => handleRelatedClick(rq)}
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        textAlign: 'left', fontSize: 13, color: T, fontFamily: FB,
                                        padding: '2px 0', textDecoration: 'underline',
                                        textDecorationColor: T + '40'
                                      }}
                                      onMouseEnter={e => e.target.style.color = '#2a9aa3'}
                                      onMouseLeave={e => e.target.style.color = T}
                                    >
                                      → {rq}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40, padding: '24px', borderRadius: 12, background: GRY,
          textAlign: 'center', border: '1px solid #e5e5e5'
        }}>
          <FileText size={24} color={T} style={{ marginBottom: 8 }} />
          <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, margin: '0 0 4px 0' }}>
            Still need help?
          </p>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
            Contact us at <a href="mailto:support@koto.agency" style={{ color: T, textDecoration: 'none', fontWeight: 600 }}>support@koto.agency</a> or create a ticket in KotoDesk.
          </p>
        </div>
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )

  if (isMobile) {
    return (
      <MobilePage>
        <MobilePageHeader title="Help Center" />
        {content}
      </MobilePage>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {content}
      </div>
    </div>
  )
}