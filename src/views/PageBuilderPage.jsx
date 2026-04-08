"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, ChevronDown, ChevronRight, Eye, Globe, Check, Send, Loader2, X,
  Edit2, FileText, Type, LayoutGrid, HelpCircle, Settings, RefreshCw, Search,
  Link, AlertCircle, Plus, ExternalLink
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

/* ── Design tokens ────────────────────────────────────────────── */
const R   = '#E6007E',T='#00C2CB',BLK='#111111',GRY='#F9F9F9',GRN='#16a34a',AMB='#f59e0b'
const FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB="'Raleway','Helvetica Neue',sans-serif"

/* ── 43 wildcard field definitions ────────────────────────────── */
const WILDCARD_SECTIONS = [
  { title:'Location', fields:[
    {key:'{city}',label:'City',example:'Fort Lauderdale'},
    {key:'{state}',label:'State (abbr)',example:'FL'},
    {key:'{state_full}',label:'State (full)',example:'Florida'},
    {key:'{county}',label:'County',example:'Broward'},
    {key:'{zip}',label:'ZIP Code',example:'33301'},
    {key:'{region}',label:'Region',example:'South Florida'},
    {key:'{neighborhood}',label:'Neighborhood',example:'Downtown'},
  ]},
  { title:'Business', fields:[
    {key:'{business_name}',label:'Business Name',example:'Acme Co'},
    {key:'{phone}',label:'Phone',example:'(555) 555-5555'},
    {key:'{email}',label:'Email',example:'info@business.com'},
    {key:'{address}',label:'Address',example:'123 Main St'},
    {key:'{website}',label:'Website',example:'www.business.com'},
    {key:'{hours}',label:'Hours',example:'Mon-Fri 8am-6pm'},
    {key:'{founded}',label:'Year Founded',example:'2015'},
    {key:'{owner_name}',label:'Owner Name',example:'John Smith'},
  ]},
  { title:'Service', fields:[
    {key:'{service}',label:'Service',example:'Plumbing'},
    {key:'{service_plural}',label:'Service (plural)',example:'Plumbing Services'},
    {key:'{keyword}',label:'Keyword',example:'plumber near me'},
    {key:'{price_range}',label:'Price Range',example:'$150-$500'},
    {key:'{response_time}',label:'Response Time',example:'same-day'},
    {key:'{year}',label:'Year',example:'2026'},
  ]},
  { title:'Trust', fields:[
    {key:'{review_count}',label:'Review Count',example:'150+'},
    {key:'{rating}',label:'Star Rating',example:'4.9'},
    {key:'{certifications}',label:'Certifications',example:'Google Partner'},
    {key:'{unique_fact}',label:'Unique Local Fact',example:'a vibrant community'},
    {key:'{local_landmark}',label:'Local Landmark',example:'Las Olas Blvd'},
    {key:'{call_to_action}',label:'CTA Text',example:'Get a Free Audit'},
    {key:'{testimonial}',label:'Testimonial',example:'Best service ever!'},
    {key:'{testimonial_author}',label:'Testimonial Author',example:'Jane D.'},
    {key:'{nearby_city_1}',label:'Nearby City 1',example:'Hollywood'},
    {key:'{nearby_city_2}',label:'Nearby City 2',example:'Pompano Beach'},
    {key:'{nearby_city_3}',label:'Nearby City 3',example:'Dania Beach'},
    {key:'{service_radius}',label:'Service Radius',example:'25 miles'},
    {key:'{population}',label:'Population',example:'183,000'},
    {key:'{license_number}',label:'License Number',example:'LIC-123456'},
    {key:'{warranty}',label:'Warranty',example:'2-year warranty'},
    {key:'{guarantee}',label:'Guarantee',example:'100% satisfaction guaranteed'},
    {key:'{payment_methods}',label:'Payment Methods',example:'Cash, Card, Financing'},
    {key:'{financing}',label:'Financing',example:'0% financing available'},
  ]},
  { title:'Local Context', fields:[
    {key:'{local_problem}',label:'Local Problem',example:'hard water issues'},
    {key:'{local_solution}',label:'Local Solution',example:'our water treatment systems'},
    {key:'{seasonal_hook}',label:'Seasonal Hook',example:'With Florida summers...'},
  ]},
]

const ALL_WILDCARDS = WILDCARD_SECTIONS.flatMap(s=>s.fields)

/* ── Default wildcard values ──────────────────────────────────── */
function buildDefaultValues(){
  const map={}
  ALL_WILDCARDS.forEach(w=>{map[w.key]=w.example})
  return map
}

/* ── 11 Content modules with variants ─────────────────────────── */
const DEFAULT_MODULES = [
  {id:'intro',label:'Introduction',icon:Type,description:'Opening section with service + location headline',variants:[
    {id:'intro_a',label:'Variant 1 — Direct & Professional',content:`<h2>Professional {service} in {city}, {state}</h2>\n<p>{business_name} provides expert {service} throughout {city}, {county} County, {state}. Our experienced team has served homeowners and businesses in {city} for years, building a reputation for reliability and outstanding results.</p>\n<p>When you need {service} in {city}, you can count on {business_name} to deliver fast, professional service at competitive prices. We understand the unique needs of {city} residents and tailor our {service_plural} accordingly.</p>`},
    {id:'intro_b',label:'Variant 2 — Question Hook',content:`<h2>Looking for {service} in {city}, {state}?</h2>\n<p>Your search ends here. {business_name} has been the trusted name for {service} in {city} and throughout {county} County. Our certified professionals bring years of local expertise to every project — and we back every job with our satisfaction guarantee.</p>\n<p>From {neighborhood} to the surrounding communities, {business_name} delivers {service_plural} that exceed expectations. {call_to_action} — contact us today for your free consultation.</p>`},
    {id:'intro_c',label:'Variant 3 — Authority Lead',content:`<h2>Your Trusted {service} Provider in {city}</h2>\n<p>Serving {city}, {state_full} since {founded}, {business_name} brings professional-grade {service} to every home and business we work with. Our commitment to excellence sets us apart — {review_count} satisfied clients and a {rating}-star rating prove it.</p>\n<p>Whether you need routine service or a complete solution, {business_name} has the expertise to handle every aspect of {service} in {city}. Contact us today for a free, no-obligation estimate.</p>`},
  ]},
  {id:'what_is',label:'What Is This Service',icon:HelpCircle,description:'Educational content explaining the service',variants:[
    {id:'what_is_a',label:'Variant 1 — Explainer',content:`<h2>What Is {service} and Why Does Your {city} Property Need It?</h2>\n<p>{service} encompasses a range of professional solutions designed to keep your property safe, functional, and efficient. For {city} homeowners and businesses, investing in quality {service} is not just a convenience — it is a necessity.</p>\n<p>The {region} climate presents unique challenges that make professional {service} essential. {local_problem} is a common concern for properties in {county} County, and without proper attention, small issues can quickly become costly repairs.</p>\n<p>{business_name} specializes in delivering {service_plural} tailored specifically to the needs of {city} properties, using proven methods and premium materials that stand up to local conditions.</p>`},
    {id:'what_is_b',label:'Variant 2 — Benefits Focused',content:`<h2>Understanding {service} in {city}, {state_full}</h2>\n<p>Professional {service} is the backbone of property maintenance in {city}. Whether you are a homeowner in {neighborhood} or a business owner near {local_landmark}, understanding what {service} involves helps you make informed decisions about your property.</p>\n<p>At its core, {service} includes inspection, maintenance, repair, and installation services. {business_name} goes beyond the basics — we bring {certifications} credentials, local expertise, and a commitment to lasting results for every {city} client.</p>\n<p>Investing in professional {service} now prevents expensive emergencies later. With {business_name}, you get transparent pricing ({price_range}), {response_time} availability, and the peace of mind that comes from working with {county} County's most trusted provider.</p>`},
  ]},
  {id:'why_us',label:'Why Choose Us',icon:Check,description:'Trust signals and differentiators',variants:[
    {id:'why_a',label:'Variant 1 — 6 Benefits',content:`<h2>Why {city} Residents Choose {business_name}</h2>\n<ul>\n<li><strong>Licensed and Insured:</strong> Fully licensed ({license_number}) and insured for your peace of mind in {state_full}.</li>\n<li><strong>Local Expertise:</strong> Years of experience serving {city} and {county} County.</li>\n<li><strong>{rating}-Star Rated:</strong> {review_count} happy clients across {city} trust us.</li>\n<li><strong>Transparent Pricing:</strong> Upfront quotes with no hidden fees ({price_range}).</li>\n<li><strong>Fast Response:</strong> {response_time} service available throughout {city}.</li>\n<li><strong>Satisfaction Guaranteed:</strong> {guarantee}.</li>\n</ul>`},
    {id:'why_b',label:'Variant 2 — The Difference',content:`<h2>The {business_name} Difference in {city}</h2>\n<p>Not all {service} providers are created equal. Here is what makes {business_name} the right choice for {city}:</p>\n<ul>\n<li><strong>Proven Track Record:</strong> {review_count} completed projects in {county} County.</li>\n<li><strong>Certified Professionals:</strong> Every team member holds required {state} certifications. {certifications}.</li>\n<li><strong>Premium Materials Only:</strong> We never cut corners — your investment deserves the best.</li>\n<li><strong>Clear Communication:</strong> Regular updates so you always know your project status.</li>\n<li><strong>Locally Owned:</strong> {owner_name} founded {business_name} in {founded} — this community is our home too.</li>\n<li><strong>{warranty}:</strong> Every project backed by our industry-leading warranty.</li>\n</ul>`},
  ]},
  {id:'services',label:'Services Offered',icon:LayoutGrid,description:'Breakdown of specific services with descriptions',variants:[
    {id:'services_a',label:'Variant 1 — Residential & Commercial',content:`<h2>Our {service} Services in {city}</h2>\n<p>{business_name} offers comprehensive {service} solutions for {city} homeowners and businesses throughout {county} County.</p>\n<h3>Residential {service_plural}</h3>\n<p>Homeowners throughout {city} trust {business_name} for reliable {service}. We understand the specific needs of residential properties in {city} and provide solutions that fit your lifestyle and budget of {price_range}.</p>\n<h3>Commercial {service_plural}</h3>\n<p>Businesses across {city} rely on {business_name} for professional-grade {service}. We minimize disruption to your operations and deliver efficient solutions on time and on budget.</p>\n<h3>Emergency & Same-Day Service</h3>\n<p>When you need {service} fast in {city}, {business_name} responds quickly. We offer {response_time} service throughout {county} County — because some problems cannot wait.</p>`},
    {id:'services_b',label:'Variant 2 — Process Focused',content:`<h2>How We Deliver {service} in {city}</h2>\n<h3>Step 1: Free Consultation</h3>\n<p>Every project starts with a thorough assessment of your specific situation in {city}. Our experts evaluate your needs and develop a customized plan — at no charge.</p>\n<h3>Step 2: Custom Solution</h3>\n<p>Based on your assessment, {business_name} creates a tailored {service} solution designed specifically for your {city} property with transparent pricing of {price_range}.</p>\n<h3>Step 3: Professional Execution</h3>\n<p>Our certified team executes your project with precision using premium materials. We keep you informed every step of the way.</p>\n<h3>Step 4: Follow-Up</h3>\n<p>After completion, {business_name} follows up to ensure you are fully satisfied. Our {warranty} means we stand behind every job in {city}.</p>`},
  ]},
  {id:'local',label:'Local Area Focus',icon:Globe,description:'Hyperlocal content referencing the city and area',variants:[
    {id:'local_a',label:'Variant 1 — Community Focus',content:`<h2>{service} Across {city} and {county} County</h2>\n<p>{business_name} is proud to be a trusted local resource for {service} in {city}. As a locally focused business, we understand the {city} community — {unique_fact} — and bring that knowledge to every project.</p>\n<p>We serve all neighborhoods throughout {city}, including areas near {local_landmark} and surrounding communities. Whether you are in {neighborhood} or anywhere in {county} County, {business_name} is just a call away.</p>\n<p>Beyond {city}, we also serve {nearby_city_1}, {nearby_city_2}, and {nearby_city_3} — bringing the same level of excellence to every community in our {service_radius} service area.</p>`},
    {id:'local_b',label:'Variant 2 — Market Authority',content:`<h2>Serving {city} and the Greater {county} County Area</h2>\n<p>When {city} residents and businesses need {service}, {business_name} answers the call. Our deep roots in {county} County give us unique insight into what local clients need — and how to deliver it better than out-of-area competitors.</p>\n<p>{city} is a thriving community with a population of {population}. {business_name} brings exactly the right local expertise to every {service} project — understanding challenges like {local_problem} and solving them with {local_solution}.</p>\n<p>Our {service_radius} service area covers {city} and extends to {nearby_city_1}, {nearby_city_2}, {nearby_city_3}, and communities throughout {county} County and {state_full}.</p>`},
  ]},
  {id:'process',label:'Our Process',icon:Settings,description:'Step-by-step how-it-works section',variants:[
    {id:'process_a',label:'Variant 1 — 4 Steps',content:`<h2>How {business_name} Works in {city}</h2>\n<p>We have streamlined our {service} process to make it simple for {city} homeowners and businesses:</p>\n<h3>1. Contact Us</h3>\n<p>Call {phone} or fill out our online form. We respond within minutes — not hours. Our {response_time} availability means you will never be left waiting.</p>\n<h3>2. Free On-Site Assessment</h3>\n<p>A certified {business_name} professional visits your {city} property to evaluate your needs and provide a detailed, upfront quote. No surprises, no hidden fees.</p>\n<h3>3. Expert Service Delivery</h3>\n<p>Our experienced team completes your {service} project efficiently and professionally. We respect your property, clean up after ourselves, and ensure everything meets our exacting standards.</p>\n<h3>4. Quality Guarantee</h3>\n<p>We follow up to confirm your complete satisfaction. Every project is backed by our {warranty} and {guarantee}. {business_name} stands behind every job in {city}.</p>`},
    {id:'process_b',label:'Variant 2 — Timeline Focused',content:`<h2>What to Expect When You Hire {business_name} in {city}</h2>\n<p>Hiring a {service} provider in {city} should be straightforward. Here is exactly what happens when you choose {business_name}:</p>\n<p><strong>Day 1 — Initial Contact:</strong> Reach out via phone ({phone}) or email ({email}). Our team gathers basic information about your {service} needs and schedules a convenient time for your free assessment.</p>\n<p><strong>Day 1-2 — Assessment & Quote:</strong> A {business_name} expert visits your property, evaluates the scope of work, and provides a transparent quote ({price_range} for most projects). No pressure, no obligation.</p>\n<p><strong>Scheduled Date — Service Day:</strong> Our certified team arrives on time, fully equipped, and ready to deliver outstanding {service}. We communicate throughout the process and leave your {city} property spotless.</p>\n<p><strong>After Completion — Follow-Up:</strong> We check in to ensure everything exceeds your expectations. Remember, our {guarantee} means your satisfaction is guaranteed.</p>`},
  ]},
  {id:'trust',label:'Trust & Social Proof',icon:Sparkles,description:'Reviews, testimonials, and credibility signals',variants:[
    {id:'trust_a',label:'Variant 1 — Review Spotlight',content:`<h2>What {city} Clients Say About {business_name}</h2>\n<p>With {review_count} reviews and a {rating}-star average rating, {business_name} is one of the highest-rated {service} providers in {county} County.</p>\n<blockquote style="border-left:4px solid #E6007E;padding:12px 16px;margin:16px 0;background:#fafafa;border-radius:0 8px 8px 0;">\n<p style="font-style:italic;margin:0 0 8px 0;">"{testimonial}"</p>\n<p style="margin:0;font-weight:bold;">— {testimonial_author}</p>\n</blockquote>\n<p>Our clients in {city} consistently praise our professionalism, transparent pricing, and quality workmanship. We are proud to maintain our reputation as {city}'s most trusted {service} provider.</p>\n<p><strong>Our Credentials:</strong> {certifications} | Licensed ({license_number}) | Insured | {warranty}</p>`},
    {id:'trust_b',label:'Variant 2 — Numbers Story',content:`<h2>Trusted by {city} Since {founded}</h2>\n<p>{business_name} has been serving {city} and {county} County for over {year} years. In that time, we have built an unmatched track record:</p>\n<ul>\n<li><strong>{review_count}</strong> satisfied clients across {county} County</li>\n<li><strong>{rating}-star</strong> average rating on Google</li>\n<li><strong>{service_radius}</strong> service coverage area</li>\n<li><strong>{response_time}</strong> response time for {city} residents</li>\n<li><strong>{certifications}</strong> certified professionals</li>\n</ul>\n<p>"{testimonial}" — <strong>{testimonial_author}</strong></p>\n<p>{owner_name} founded {business_name} with a simple mission: deliver honest, high-quality {service} to {city} at fair prices. That mission has not changed.</p>`},
  ]},
  {id:'comparison',label:'Comparison / vs.',icon:Search,description:'Position against competitors or DIY alternatives',variants:[
    {id:'comparison_a',label:'Variant 1 — Pro vs DIY',content:`<h2>Professional {service} vs. DIY in {city}</h2>\n<p>While some {city} homeowners consider handling {service} themselves, professional service offers significant advantages:</p>\n<table style="width:100%;border-collapse:collapse;margin:16px 0;">\n<tr style="background:#f9fafb;"><th style="padding:10px 14px;text-align:left;border:1px solid #e5e7eb;font-weight:700;">Factor</th><th style="padding:10px 14px;text-align:left;border:1px solid #e5e7eb;font-weight:700;">DIY</th><th style="padding:10px 14px;text-align:left;border:1px solid #e5e7eb;font-weight:700;">{business_name}</th></tr>\n<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;">Cost</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Variable, risk of errors</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Transparent: {price_range}</td></tr>\n<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;">Quality</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Unpredictable</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Professional grade, guaranteed</td></tr>\n<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;">Time</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Days or weeks</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">{response_time} service</td></tr>\n<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;">Warranty</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">None</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">{warranty}</td></tr>\n<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;">Insurance</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Your liability</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">Fully covered</td></tr>\n</table>\n<p>Skip the guesswork. {business_name} delivers professional {service} in {city} at competitive prices with results you can trust.</p>`},
    {id:'comparison_b',label:'Variant 2 — Why Local Beats National',content:`<h2>Why {city} Chooses {business_name} Over National Chains</h2>\n<p>National franchise {service} providers may seem convenient, but {city} residents are discovering the advantages of working with a local expert:</p>\n<ul>\n<li><strong>Local Knowledge:</strong> We understand {city} properties, local codes, and challenges like {local_problem}. National chains do not.</li>\n<li><strong>Direct Communication:</strong> Talk directly to {owner_name} and our team — no call centers, no runaround.</li>\n<li><strong>Community Investment:</strong> Every dollar you spend with {business_name} stays in {county} County.</li>\n<li><strong>Faster Response:</strong> We are right here in {city} — {response_time} response, not days.</li>\n<li><strong>Accountability:</strong> Our {rating}-star rating and {review_count} reviews from {city} neighbors speak for themselves.</li>\n</ul>\n<p>When you choose {business_name}, you are choosing a partner who cares about {city} as much as you do.</p>`},
  ]},
  {id:'faq',label:'FAQ Block',icon:HelpCircle,description:'AEO-optimized FAQ with schema markup',variants:[
    {id:'faq_a',label:'Variant 1 — Cost & Trust',content:`<h2>Frequently Asked Questions About {service} in {city}</h2>\n<div class="koto-faq" itemscope itemtype="https://schema.org/FAQPage">\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">How much does {service} cost in {city}, {state}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">The cost of {service} in {city} varies based on scope and your specific needs. {business_name} offers free estimates with transparent pricing of {price_range} for the {county} County area. Contact us for your free quote.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">Is {business_name} licensed and insured for {service} in {state}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Yes. {business_name} is fully licensed, bonded, and insured to provide {service} in {state_full}. License: {license_number}. Our team holds all required certifications and stays current with local codes.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">How quickly can {business_name} respond in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">We offer {response_time} service throughout {city} and {county} County. Most inquiries receive same-day or next-day appointments.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What areas near {city} do you serve?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{business_name} serves {city} and surrounding communities including {nearby_city_1}, {nearby_city_2}, and {nearby_city_3} throughout {county} County. Our service radius covers {service_radius} from {city}.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">Do you offer financing for {service} in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Yes. {business_name} offers {financing} for qualified {city} customers. We accept {payment_methods}. Contact us for flexible payment options.</p></div></div>\n</div>`},
    {id:'faq_b',label:'Variant 2 — Value & Results',content:`<h2>Common Questions About {service} in {city}</h2>\n<div class="koto-faq" itemscope itemtype="https://schema.org/FAQPage">\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">Why should I choose {business_name} for {service} in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{business_name} combines local expertise, certified professionals, transparent pricing, and a proven track record in {city}. With {review_count} satisfied clients and a {rating}-star rating, we are {city}'s most trusted {service} provider.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What is your warranty on {service} work?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{business_name} stands behind every project with our {warranty}. If you are not satisfied, we will make it right — that is our {guarantee}.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What do {city} customers say about {business_name}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">"{testimonial}" — {testimonial_author}. With {review_count} reviews and a {rating}-star rating, {city} customers consistently praise our work.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What makes {city} unique for {service}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{city}, {state_full} has unique characteristics — {local_problem} is a common local challenge. {business_name} uses {local_solution} to deliver {service} perfectly suited to the {city} environment.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">How do I get started?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Call us at {phone} or fill out our online form. We provide a free assessment and can often begin within days. {seasonal_hook}</p></div></div>\n</div>`},
  ]},
  {id:'internal_links',label:'Internal Links',icon:Link,description:'Related pages and service area links for SEO',variants:[
    {id:'links_a',label:'Variant 1 — Service Area Links',content:`<h2>Explore {business_name} {service_plural} Near You</h2>\n<p>{business_name} is proud to serve {city} and the surrounding {county} County communities. Learn more about our {service} in nearby areas:</p>\n<ul>\n<li><a href="/{nearby_city_1}/{keyword}">{service} in {nearby_city_1}, {state}</a></li>\n<li><a href="/{nearby_city_2}/{keyword}">{service} in {nearby_city_2}, {state}</a></li>\n<li><a href="/{nearby_city_3}/{keyword}">{service} in {nearby_city_3}, {state}</a></li>\n<li><a href="/{county}-county/{keyword}">{service} in {county} County, {state}</a></li>\n<li><a href="/{region}/{keyword}">{service} in {region}</a></li>\n</ul>\n<p>No matter where you are in our {service_radius} service area, {business_name} delivers the same exceptional {service_plural} that {city} residents have come to trust.</p>`},
    {id:'links_b',label:'Variant 2 — Related Services',content:`<h2>More {service_plural} from {business_name} in {city}</h2>\n<p>In addition to {service}, {business_name} offers a full range of professional services for {city} homeowners and businesses:</p>\n<ul>\n<li><a href="/services/residential">Residential {service_plural}</a> — Tailored solutions for {city} homes</li>\n<li><a href="/services/commercial">Commercial {service_plural}</a> — Professional service for {city} businesses</li>\n<li><a href="/services/emergency">Emergency {service}</a> — {response_time} availability in {county} County</li>\n<li><a href="/about">About {business_name}</a> — Meet {owner_name} and our team</li>\n<li><a href="/reviews">{city} Reviews</a> — Read {review_count} reviews from your neighbors</li>\n</ul>\n<p>Have questions? Call {phone} or email {email}. {business_name} is here to help with all your {service} needs in {city}, {state_full}.</p>`},
  ]},
  {id:'cta',label:'Call to Action',icon:Send,description:'Closing section driving phone calls and form submissions',variants:[
    {id:'cta_a',label:'Variant 1 — Urgency CTA',content:`<h2>Ready for Expert {service} in {city}? Contact {business_name} Today</h2>\n<p>Do not settle for less when it comes to {service} in {city}. {business_name} delivers the professional results you deserve — backed by our {guarantee} and {warranty}.</p>\n<p><strong>Call us now: <a href="tel:{phone}">{phone}</a></strong></p>\n<p>We serve all of {city}, {county} County, and surrounding areas including {nearby_city_1}, {nearby_city_2}, and {nearby_city_3}. {call_to_action} — your free consultation is just one call away.</p>\n<p>{seasonal_hook} There has never been a better time to invest in quality {service} for your {city} property.</p>`},
    {id:'cta_b',label:'Variant 2 — Trust CTA',content:`<h2>{service} in {city} — {business_name} Is Here to Help</h2>\n<p>Join {review_count} satisfied clients throughout {city} and {county} County who trust {business_name} for their {service} needs. Our {rating}-star rating speaks for itself — and our {guarantee} means you have nothing to lose.</p>\n<p><strong>Call: <a href="tel:{phone}">{phone}</a> | Email: <a href="mailto:{email}">{email}</a></strong></p>\n<p>{business_name} — {city}'s trusted {service} provider since {founded}. Serving {city}, {nearby_city_1}, {nearby_city_2}, {nearby_city_3} and all of {county} County, {state_full} {zip}.</p>`},
  ]},
]

/* ── Helper: replace all wildcard tokens in a string ──────────── */
function fillWildcards(text, values) {
  if (!text) return ''
  let result = text
  Object.entries(values).forEach(([key, val]) => {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val || key)
  })
  return result
}

/* ── Helper: count words in HTML string ───────────────────────── */
function wordCount(html) {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.split(' ').length : 0
}

/* ── Step indicator config ────────────────────────────────────── */
const STEPS = [
  { n: 1, label: 'Setup' },
  { n: 2, label: 'Research' },
  { n: 3, label: 'Review' },
  { n: 4, label: 'Deploy' },
]

/* ── ModuleAccordion sub-component ────────────────────────────── */
function ModuleAccordion({ module, wildcardValues, onEditVariant, onSelectVariant, selectedVariants, onRegenerate, isRegenerating }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const Icon = module.icon || FileText

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 10 }}>
      {/* Accordion header */}
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', borderBottom: open ? '1px solid #f3f4f6' : 'none',
          transition: 'background .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fafafa' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: R + '12',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} color={R} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 700, color: BLK }}>{module.label}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
            {module.description} &middot; {module.variants.length} variant{module.variants.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: T, fontFamily: FH,
          background: T + '15', padding: '3px 10px', borderRadius: 20,
        }}>
          {module.variants.length}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRegenerate(module.id) }}
          disabled={isRegenerating}
          style={{
            padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: '#fff', fontSize: 11, fontWeight: 600, cursor: isRegenerating ? 'not-allowed' : 'pointer',
            fontFamily: FH, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4,
            opacity: isRegenerating ? 0.5 : 1,
          }}
          title="Regenerate this module with AI"
        >
          {isRegenerating
            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={11} />}
          Regen
        </button>
        {open ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
      </div>

      {/* Expanded variants */}
      {open && (
        <div style={{ padding: '12px 18px' }}>
          {module.variants.map((variant, idx) => {
            const isSelected = selectedVariants[module.id] === variant.id
            const isEditing = editingId === variant.id
            const filled = fillWildcards(variant.content, wildcardValues)
            const wc = wordCount(variant.content)

            return (
              <div key={variant.id} style={{
                marginBottom: 12,
                border: `1.5px solid ${isSelected ? R : '#e5e7eb'}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                {/* Variant header */}
                <div style={{
                  padding: '10px 14px', background: isSelected ? R + '08' : '#fafafa',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <button
                    onClick={() => onSelectVariant(module.id, variant.id)}
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${isSelected ? R : '#d1d5db'}`,
                      background: isSelected ? R : '#fff', flexShrink: 0,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </button>
                  <span style={{ fontFamily: FH, fontSize: 12, fontWeight: 700, color: isSelected ? R : BLK, flex: 1 }}>
                    Variant {idx + 1}
                    <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 11 }}>
                      {variant.label}
                    </span>
                  </span>
                  <span style={{
                    fontSize: 10, color: '#9ca3af', fontFamily: FH, fontWeight: 600,
                    background: '#f3f4f6', padding: '2px 8px', borderRadius: 10,
                  }}>
                    {wc} words
                  </span>
                  <button
                    onClick={() => { setEditingId(isEditing ? null : variant.id); setEditContent(variant.content) }}
                    style={{
                      padding: '4px 10px', borderRadius: 7, border: '1px solid #e5e7eb',
                      background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      fontFamily: FH, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {isEditing ? <X size={11} /> : <Edit2 size={11} />}
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {/* Inline editor */}
                {isEditing && (
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', background: '#fffbf5' }}>
                    <div style={{ fontSize: 11, color: AMB, fontFamily: FH, fontWeight: 700, marginBottom: 6 }}>
                      <AlertCircle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Editing raw HTML — use wildcards like {'{city}'}, {'{service}'}, etc.
                    </div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      style={{
                        width: '100%', height: 180, padding: 10, borderRadius: 9,
                        border: '1.5px solid #e5e7eb', fontSize: 12, fontFamily: 'monospace',
                        outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                        lineHeight: 1.5,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => { onEditVariant(module.id, variant.id, editContent); setEditingId(null) }}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none',
                          background: GRN, color: '#fff', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: FH,
                        }}
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                          background: '#fff', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: FH, color: '#6b7280',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Rendered HTML preview */}
                <div
                  style={{
                    padding: 14, background: '#fff', fontSize: 13,
                    fontFamily: FB, color: '#374151', lineHeight: 1.7,
                  }}
                  dangerouslySetInnerHTML={{ __html: filled.replace(/\n/g, '') }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Preview Modal ────────────────────────────────────────────── */
function PreviewModal({ html, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '90vw', maxWidth: 900, maxHeight: '90vh', background: '#fff',
        borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fafafa', flexShrink: 0,
        }}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
            <Eye size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Full Page Preview
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: FH }}>
              {wordCount(html)} words
            </span>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} color="#6b7280" />
            </button>
          </div>
        </div>
        <div
          style={{
            flex: 1, overflowY: 'auto', padding: '32px 48px',
            fontFamily: FB, fontSize: 15, lineHeight: 1.8, color: '#374151',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

/* ── Research Insights Panel ──────────────────────────────────── */
function ResearchInsights({ data }) {
  if (!data) return null
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      padding: 18, marginBottom: 16,
    }}>
      <div style={{
        fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK, marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Sparkles size={15} color={T} />
        Research Insights
      </div>

      {/* Content gaps */}
      {data.content_gaps?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Content Gaps
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.content_gaps.map((gap, i) => (
              <span key={i} style={{
                padding: '4px 10px', borderRadius: 20, background: R + '10',
                color: R, fontSize: 11, fontWeight: 600, fontFamily: FH,
              }}>
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PAA Questions */}
      {data.paa_questions?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            People Also Ask
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, fontFamily: FB, color: '#374151', lineHeight: 1.8 }}>
            {data.paa_questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {/* Semantic keywords */}
      {data.semantic_keywords?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Semantic Keywords
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.semantic_keywords.map((kw, i) => (
              <span key={i} style={{
                padding: '4px 10px', borderRadius: 20, background: T + '15',
                color: T, fontSize: 11, fontWeight: 600, fontFamily: FH,
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended metrics */}
      <div style={{ display: 'flex', gap: 16 }}>
        {data.recommended_word_count && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, background: '#f9fafb',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>
              Target Words
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: BLK, fontFamily: FH }}>
              {data.recommended_word_count}
            </div>
          </div>
        )}
        {data.recommended_structure && (
          <div style={{
            padding: '8px 14px', borderRadius: 10, background: '#f9fafb',
            border: '1px solid #e5e7eb', flex: 1,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FH, textTransform: 'uppercase' }}>
              Recommended Structure
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: FB, marginTop: 2 }}>
              {data.recommended_structure}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Main PageBuilderPage component
   ══════════════════════════════════════════════════════════════════ */
export default function PageBuilderPage() {
  const { agencyId } = useAuth()
  const navigate = useNavigate()

  // Sites
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [loadingSites, setLoadingSites] = useState(false)
  const [sitemapPages, setSitemapPages] = useState([])

  // Modules & selections
  const [modules, setModules] = useState(DEFAULT_MODULES)
  const [selectedVariants, setSelectedVariants] = useState(() => {
    const map = {}
    DEFAULT_MODULES.forEach(m => { map[m.id] = m.variants[0]?.id || '' })
    return map
  })

  // Wildcards
  const [wildcardValues, setWildcardValues] = useState(buildDefaultValues)
  const [showLeftPanel, setShowLeftPanel] = useState(true)

  // Research
  const [researchData, setResearchData] = useState(null)
  const [researching, setResearching] = useState(false)
  const [regeneratingModule, setRegeneratingModule] = useState(null)

  // Deploy
  const [deploying, setDeploying] = useState(false)
  const [deployed, setDeployed] = useState(null)

  // Preview modal
  const [showPreview, setShowPreview] = useState(false)

  // Current step
  const currentStep = deployed ? 4 : researchData ? 3 : selectedSite ? 2 : 1

  /* ── Load sites on mount ────────────────────────────────────── */
  useEffect(() => {
    if (agencyId) loadSites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId])

  async function loadSites() {
    setLoadingSites(true)
    try {
      const res = await fetch(`/api/wp?agency_id=${agencyId || '00000000-0000-0000-0000-000000000099'}`)
      const data = await res.json()
      setSites(data.sites || [])
      if (data.sites?.length) setSelectedSite(data.sites[0])
    } catch (e) {
      toast.error('Failed to load WordPress sites')
    }
    setLoadingSites(false)
  }

  /* ── Fetch sitemap when site changes ────────────────────────── */
  useEffect(() => {
    if (selectedSite) fetchSitemap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSite?.id])

  async function fetchSitemap() {
    if (!selectedSite) return
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_sitemap',
          site_url: selectedSite.site_url || selectedSite.url,
          agency_id: agencyId || '00000000-0000-0000-0000-000000000099',
        }),
      })
      const data = await res.json()
      setSitemapPages(data.pages || [])
      if (data.pages?.length) {
        toast.success(`Sitemap loaded: ${data.pages.length} pages found`)
      }
    } catch {
      // Sitemap fetch is optional — fail silently
    }
  }

  /* ── Research & Generate All ────────────────────────────────── */
  async function runFullResearch() {
    setResearching(true)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_research',
          agency_id: agencyId || '00000000-0000-0000-0000-000000000099',
          site_id: selectedSite?.id,
          wildcards: wildcardValues,
          keyword: wildcardValues['{keyword}'],
          city: wildcardValues['{city}'],
          state: wildcardValues['{state}'],
          service: wildcardValues['{service}'],
          modules: modules.map(m => m.id),
        }),
      })
      const data = await res.json()

      // Apply research insights
      if (data.insights) {
        setResearchData(data.insights)
      }

      // Apply generated module content if returned
      if (data.modules) {
        setModules(prev => prev.map(mod => {
          const generated = data.modules[mod.id]
          if (generated?.variants?.length) {
            return {
              ...mod,
              variants: [
                ...mod.variants,
                ...generated.variants.map((v, i) => ({
                  id: `${mod.id}_ai_${Date.now()}_${i}`,
                  label: `AI Generated ${i + 1}`,
                  content: v.content || v,
                })),
              ],
            }
          }
          return mod
        }))
        toast.success('Research complete — new AI variants added!')
      } else {
        toast.success('Research analysis complete!')
      }
    } catch (e) {
      toast.error('Research failed: ' + (e.message || 'Unknown error'))
    }
    setResearching(false)
  }

  /* ── Regenerate single module ───────────────────────────────── */
  async function regenerateModule(moduleId) {
    setRegeneratingModule(moduleId)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_module',
          agency_id: agencyId || '00000000-0000-0000-0000-000000000099',
          module_id: moduleId,
          wildcards: wildcardValues,
          keyword: wildcardValues['{keyword}'],
          city: wildcardValues['{city}'],
          state: wildcardValues['{state}'],
          service: wildcardValues['{service}'],
        }),
      })
      const data = await res.json()

      if (data.variant) {
        setModules(prev => prev.map(mod => {
          if (mod.id !== moduleId) return mod
          const newVariant = {
            id: `${moduleId}_regen_${Date.now()}`,
            label: `AI Regen ${mod.variants.length}`,
            content: data.variant.content || data.variant,
          }
          return { ...mod, variants: [...mod.variants, newVariant] }
        }))
        toast.success(`New variant generated for ${moduleId}`)
      } else {
        toast.error('No content returned')
      }
    } catch (e) {
      toast.error('Regenerate failed: ' + (e.message || 'Unknown error'))
    }
    setRegeneratingModule(null)
  }

  /* ── Build final assembled content ──────────────────────────── */
  function buildFinalContent() {
    return modules.map(mod => {
      const variantId = selectedVariants[mod.id]
      const variant = mod.variants.find(v => v.id === variantId) || mod.variants[0]
      return fillWildcards(variant?.content || '', wildcardValues)
    }).join('\n\n')
  }

  /* ── Total word count ───────────────────────────────────────── */
  function getTotalWordCount() {
    return modules.reduce((total, mod) => {
      const variantId = selectedVariants[mod.id]
      const variant = mod.variants.find(v => v.id === variantId) || mod.variants[0]
      return total + wordCount(fillWildcards(variant?.content || '', wildcardValues))
    }, 0)
  }

  /* ── Deploy to WordPress ────────────────────────────────────── */
  async function deployToWordPress() {
    if (!selectedSite) { toast.error('Select a WordPress site first'); return }
    setDeploying(true)
    try {
      const content = buildFinalContent()
      const title = `${wildcardValues['{service}']} in ${wildcardValues['{city}']}, ${wildcardValues['{state}']}`
      const res = await fetch('/api/wp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_content',
          agency_id: agencyId || '00000000-0000-0000-0000-000000000099',
          site_id: selectedSite.id,
          title,
          content,
          status: 'draft',
          type: 'page',
          focus_keyword: wildcardValues['{keyword}'],
          meta_desc: `Looking for ${wildcardValues['{service}']} in ${wildcardValues['{city}']}, ${wildcardValues['{state}']}? ${wildcardValues['{business_name}']} provides expert service throughout ${wildcardValues['{county}']} County. Call ${wildcardValues['{phone}']} today.`,
        }),
      })
      const data = await res.json()
      if (data.error || !data.data?.id) throw new Error(data.error || 'Deploy failed')
      setDeployed(data.data)
      toast.success('Page deployed to WordPress as draft!')
    } catch (e) {
      toast.error(e.message)
    }
    setDeploying(false)
  }

  /* ── Edit variant content ───────────────────────────────────── */
  function handleEditVariant(moduleId, variantId, newContent) {
    setModules(prev => prev.map(m =>
      m.id === moduleId
        ? { ...m, variants: m.variants.map(v => v.id === variantId ? { ...v, content: newContent } : v) }
        : m
    ))
    toast.success('Variant saved')
  }

  /* ── Select variant ─────────────────────────────────────────── */
  function handleSelectVariant(moduleId, variantId) {
    setSelectedVariants(prev => ({ ...prev, [moduleId]: variantId }))
  }

  const totalWords = getTotalWordCount()

  /* ══════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="page-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: GRY }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top header bar ─────────────────────────────────── */}
        <div style={{
          background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '14px 28px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Title */}
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>
              Page Builder
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', fontFamily: FB, marginTop: 2 }}>
              Build once &middot; Swap wildcards &middot; Deploy to every city
            </div>
          </div>

          {/* 4-step progress indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {STEPS.map((step, idx) => {
              const isCompleted = step.n < currentStep
              const isCurrent = step.n === currentStep
              return (
                <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isCompleted ? GRN : isCurrent ? R : 'rgba(255,255,255,.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: FH,
                    transition: 'background .3s',
                  }}>
                    {isCompleted ? <Check size={13} /> : step.n}
                  </div>
                  <span style={{
                    fontSize: 12, color: isCurrent ? '#fff' : 'rgba(255,255,255,.5)',
                    fontFamily: FH, fontWeight: isCurrent ? 700 : 500,
                  }}>
                    {step.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight size={14} color="rgba(255,255,255,.2)" style={{ margin: '0 2px' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Header actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: 12, color: '#999999', fontFamily: FH, fontWeight: 600,
              background: 'rgba(255,255,255,.08)', padding: '4px 12px', borderRadius: 20,
            }}>
              {totalWords} words
            </span>
            <button
              onClick={() => setShowPreview(true)}
              style={{
                padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)',
                background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Eye size={13} /> Preview
            </button>
            <button
              onClick={deployToWordPress}
              disabled={deploying || !selectedSite}
              style={{
                padding: '8px 18px', borderRadius: 9, border: 'none',
                background: deploying ? '#6b7280' : T,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: !selectedSite || deploying ? 'not-allowed' : 'pointer',
                fontFamily: FH, display: 'flex', alignItems: 'center', gap: 6,
                opacity: !selectedSite ? 0.5 : 1,
              }}
            >
              {deploying
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={13} />}
              Deploy to WordPress
            </button>
          </div>
        </div>

        {/* ── Main content area ──────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left config panel ────────────────────────────── */}
          {showLeftPanel && (
            <div style={{
              width: 380, background: '#fff', borderRight: '1px solid #e5e7eb',
              display: 'flex', flexDirection: 'column', flexShrink: 0,
            }}>
              {/* Panel header */}
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid #f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontFamily: FH, fontSize: 14, fontWeight: 800, color: BLK }}>
                  Configuration
                </div>
                <button
                  onClick={() => setShowLeftPanel(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Site selector */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#9ca3af', fontFamily: FH,
                  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
                }}>
                  WordPress Site
                </div>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedSite?.id || ''}
                    onChange={e => {
                      const site = sites.find(s => s.id === e.target.value)
                      setSelectedSite(site || null)
                    }}
                    style={{
                      width: '100%', padding: '9px 32px 9px 12px', borderRadius: 9,
                      border: '1.5px solid #e5e7eb', fontSize: 12, fontFamily: FB,
                      outline: 'none', appearance: 'none', background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select a site...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.site_name || s.site_url || s.url}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#9ca3af" style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }} />
                </div>
                {loadingSites && (
                  <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: FB, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Loading sites...
                  </div>
                )}
                {sitemapPages.length > 0 && (
                  <div style={{
                    fontSize: 11, color: GRN, fontFamily: FH, fontWeight: 600,
                    marginTop: 6, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Check size={11} /> {sitemapPages.length} sitemap pages loaded
                  </div>
                )}
              </div>

              {/* Research & Generate button */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
                <button
                  onClick={runFullResearch}
                  disabled={researching}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: 'none', background: researching ? '#6b7280' : R,
                    color: '#fff', fontSize: 13, fontWeight: 800,
                    cursor: researching ? 'not-allowed' : 'pointer',
                    fontFamily: FH, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  {researching
                    ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Sparkles size={15} />}
                  {researching ? 'Researching...' : 'Research & Generate All'}
                </button>
                <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: FB, textAlign: 'center', marginTop: 6 }}>
                  AI analyzes your keyword, location, and competitors to generate optimized content
                </div>
              </div>

              {/* Wildcard fields — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 20px' }}>
                {WILDCARD_SECTIONS.map(section => (
                  <div key={section.title} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: T, fontFamily: FH,
                      textTransform: 'uppercase', letterSpacing: '.06em',
                      marginBottom: 8, paddingBottom: 6,
                      borderBottom: '1px solid #f3f4f6',
                    }}>
                      {section.title}
                    </div>
                    {section.fields.map(wc => (
                      <div key={wc.key} style={{ marginBottom: 8 }}>
                        <label style={{
                          fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: FH,
                          display: 'flex', alignItems: 'center', gap: 4,
                          marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em',
                        }}>
                          {wc.label}
                          <span style={{ fontSize: 9, color: T, fontFamily: 'monospace', fontWeight: 400 }}>
                            {wc.key}
                          </span>
                        </label>
                        <input
                          value={wildcardValues[wc.key] || ''}
                          onChange={e => setWildcardValues(p => ({ ...p, [wc.key]: e.target.value }))}
                          placeholder={wc.example}
                          style={{
                            width: '100%', padding: '7px 10px', borderRadius: 8,
                            border: '1.5px solid #e5e7eb', fontSize: 12, fontFamily: FB,
                            outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color .15s',
                          }}
                          onFocus={e => { e.target.style.borderColor = T }}
                          onBlur={e => { e.target.style.borderColor = '#e5e7eb' }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Center content panel ─────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

            {/* Toggle left panel button */}
            {!showLeftPanel && (
              <button
                onClick={() => setShowLeftPanel(true)}
                style={{
                  marginBottom: 16, padding: '7px 14px', borderRadius: 9,
                  border: '1px solid #e5e7eb', background: '#fff', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', fontFamily: FH, color: '#6b7280',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Settings size={13} /> Show Configuration Panel
              </button>
            )}

            {/* Research insights panel */}
            <ResearchInsights data={researchData} />

            {/* Module list header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div>
                <div style={{ fontFamily: FH, fontSize: 16, fontWeight: 800, color: BLK }}>
                  Content Modules
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: FB }}>
                  {modules.length} modules &middot; Expand each &middot; Select variant &middot; Edit if needed
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: FH,
                  color: totalWords >= 1500 ? GRN : totalWords >= 800 ? AMB : '#9ca3af',
                  background: totalWords >= 1500 ? GRN + '15' : totalWords >= 800 ? AMB + '15' : '#f3f4f6',
                  padding: '4px 10px', borderRadius: 20,
                }}>
                  {totalWords} words total
                </span>
              </div>
            </div>

            {/* Module accordions */}
            {modules.map(module => (
              <ModuleAccordion
                key={module.id}
                module={module}
                wildcardValues={wildcardValues}
                onEditVariant={handleEditVariant}
                onSelectVariant={handleSelectVariant}
                selectedVariants={selectedVariants}
                onRegenerate={regenerateModule}
                isRegenerating={regeneratingModule === module.id}
              />
            ))}

            {/* Deploy success card */}
            {deployed && (
              <div style={{
                background: '#fff', borderRadius: 14, border: `2px solid ${GRN}`,
                padding: 20, marginTop: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: GRN + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={20} color={GRN} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK }}>
                      Page Deployed to WordPress!
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: FB }}>
                      Created as draft — review in WordPress, then publish or deploy to all cities
                    </div>
                  </div>
                  {deployed.url && (
                    <a
                      href={deployed.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '8px 16px', borderRadius: 9, border: `1px solid ${GRN}`,
                        color: GRN, textDecoration: 'none', fontSize: 12, fontWeight: 700,
                        fontFamily: FH, display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <ExternalLink size={12} /> View in WordPress
                    </a>
                  )}
                </div>
                {deployed.id && (
                  <div style={{
                    padding: '8px 12px', background: '#f9fafb', borderRadius: 8,
                    fontSize: 12, fontFamily: FB, color: '#6b7280', marginBottom: 14,
                  }}>
                    WordPress Page ID: <strong style={{ color: BLK }}>{deployed.id}</strong>
                    {deployed.slug && <> &middot; Slug: <strong style={{ color: BLK }}>/{deployed.slug}</strong></>}
                  </div>
                )}
                <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 700, color: BLK, marginBottom: 10 }}>
                  Ready to scale? Deploy this template to all your target cities:
                </div>
                <button
                  onClick={() => navigate('/wordpress')}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                    background: R, color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  <Globe size={15} /> Go to WordPress Control Center to Deploy All Cities
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview modal ─────────────────────────────────────── */}
      {showPreview && (
        <PreviewModal
          html={buildFinalContent()}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── Keyframe animations ───────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .koto-faq-item { margin-bottom: 12px; }
        .koto-faq-item h3 { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
        .koto-faq-item p { margin: 0; }
      `}</style>
    </div>
  )
}
