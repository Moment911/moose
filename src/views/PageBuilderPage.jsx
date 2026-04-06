"use client"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ChevronDown, ChevronRight, Eye, Globe, Check, Send, Loader2, X, Edit2, FileText, Type, LayoutGrid, HelpCircle, Settings } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const R='#ea2729',T='#5bc6d0',BLK='#0a0a0a',GRY='#f2f2f0',GRN='#16a34a',AMB='#f59e0b'
const FH="'Proxima Nova','Nunito Sans','Helvetica Neue',sans-serif"
const FB="'Raleway','Helvetica Neue',sans-serif"

const WILDCARDS=[
  {key:'{city}',label:'City',example:'Fort Lauderdale'},
  {key:'{state}',label:'State (abbr)',example:'FL'},
  {key:'{state_full}',label:'State (full)',example:'Florida'},
  {key:'{county}',label:'County',example:'Broward'},
  {key:'{zip}',label:'ZIP Code',example:'33301'},
  {key:'{region}',label:'Region',example:'South Florida'},
  {key:'{neighborhood}',label:'Neighborhood',example:'Downtown'},
  {key:'{business_name}',label:'Business Name',example:'Acme Co'},
  {key:'{phone}',label:'Phone',example:'(555) 555-5555'},
  {key:'{phone_tracking}',label:'Tracking Phone',example:'(555) 555-1234'},
  {key:'{email}',label:'Email',example:'info@business.com'},
  {key:'{address}',label:'Address',example:'123 Main St'},
  {key:'{website}',label:'Website',example:'www.business.com'},
  {key:'{hours}',label:'Hours',example:'Mon-Fri 8am-6pm'},
  {key:'{founded}',label:'Year Founded',example:'2015'},
  {key:'{owner_name}',label:'Owner Name',example:'John Smith'},
  {key:'{service}',label:'Service',example:'Marketing Agency'},
  {key:'{service_plural}',label:'Service (plural)',example:'Marketing Agencies'},
  {key:'{service_verb}',label:'Service (verb)',example:'marketing services'},
  {key:'{keyword}',label:'Keyword',example:'marketing agency'},
  {key:'{price_range}',label:'Price Range',example:'$500-$2,000/mo'},
  {key:'{response_time}',label:'Response Time',example:'same-day'},
  {key:'{year}',label:'Year',example:'2026'},
  {key:'{month}',label:'Month',example:'April'},
  {key:'{review_count}',label:'Review Count',example:'150+'},
  {key:'{rating}',label:'Star Rating',example:'4.9'},
  {key:'{certifications}',label:'Certifications',example:'Google Partner'},
  {key:'{unique_fact}',label:'Unique Local Fact',example:'a vibrant business community'},
  {key:'{local_landmark}',label:'Local Landmark',example:'Las Olas Blvd'},
  {key:'{call_to_action}',label:'CTA Text',example:'Get a Free Audit'},
  {key:'{competitor_1}',label:'Competitor 1',example:'Big Agency Inc'},
  {key:'{competitor_2}',label:'Competitor 2',example:'Local SEO Co'},
  {key:'{market_position}',label:'Market Position',example:'the affordable alternative'},
  {key:'{testimonial}',label:'Testimonial',example:'Best agency ever!'},
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
  {key:'{local_problem}',label:'Local Problem',example:'hard water issues'},
  {key:'{local_solution}',label:'Local Solution',example:'our water treatment systems'},
  {key:'{seasonal_hook}',label:'Seasonal Hook',example:'With Florida summers...'},
  {key:'{geo_lat}',label:'Latitude',example:'26.1224'},
  {key:'{geo_lng}',label:'Longitude',example:'-80.1373'},
]

const DEFAULT_MODULES=[
  {id:'intro',label:'Introduction',icon:Type,description:'Opening section with service + location headline',variants:[
    {id:'intro_a',label:'Variant A — Direct & Professional',content:`<h2>Professional {service} in {city}, {state}</h2>\n<p>{business_name} provides expert {service} throughout {city}, {county} County, {state}. Our experienced team has served homeowners and businesses in {city} for years, building a reputation for reliability and outstanding results.</p>\n<p>When you need {service} in {city}, you can count on {business_name} to deliver fast, professional service at competitive prices. We understand the unique needs of {city} residents and tailor our services accordingly.</p>`},
    {id:'intro_b',label:'Variant B — Question Hook',content:`<h2>Looking for {service} in {city}, {state}?</h2>\n<p>Your search ends here. {business_name} has been the trusted name for {service} in {city} and throughout {county} County. Our certified professionals bring years of local expertise to every project — and we back every job with our satisfaction guarantee.</p>\n<p>From {neighborhood} to the surrounding communities, {business_name} delivers {service} that exceeds expectations. {call_to_action} — contact us today for your free consultation.</p>`},
    {id:'intro_c',label:'Variant C — Authority Lead',content:`<h2>Your Trusted {service} Provider in {city}</h2>\n<p>Serving {city}, {state_full} since {founded}, {business_name} brings professional-grade {service} to every home and business we work with. Our commitment to excellence sets us apart — {review_count} satisfied clients and a {rating}-star rating prove it.</p>\n<p>Whether you need routine service or a complete solution, {business_name} has the expertise to handle every aspect of {service} in {city}. Contact us today for a free, no-obligation estimate.</p>`},
  ]},
  {id:'why_us',label:'Why Choose Us',icon:Check,description:'Trust signals and differentiators with bullet points',variants:[
    {id:'why_a',label:'Variant A — 6 Benefits',content:`<h2>Why {city} Residents Choose {business_name}</h2>\n<ul>\n<li><strong>Licensed and Insured:</strong> Fully licensed and insured for your peace of mind in {state}.</li>\n<li><strong>Local Expertise:</strong> Years of experience serving {city} and {county} County.</li>\n<li><strong>{rating}-Star Rated:</strong> {review_count} happy clients across {city} trust us.</li>\n<li><strong>Transparent Pricing:</strong> Upfront quotes with no hidden fees.</li>\n<li><strong>Fast Response:</strong> {response_time} service available throughout {city}.</li>\n<li><strong>Satisfaction Guaranteed:</strong> {guarantee}.</li>\n</ul>`},
    {id:'why_b',label:'Variant B — The Difference',content:`<h2>The {business_name} Difference in {city}</h2>\n<p>Not all {service} providers are created equal. Here is what makes {business_name} the right choice for {city}:</p>\n<ul>\n<li><strong>Proven Track Record:</strong> {review_count} completed projects in {county} County.</li>\n<li><strong>Certified Professionals:</strong> Every team member holds required {state} certifications. {certifications}.</li>\n<li><strong>Premium Materials Only:</strong> We never cut corners — your investment deserves the best.</li>\n<li><strong>Clear Communication:</strong> Regular updates so you always know your project status.</li>\n<li><strong>Locally Owned and Operated:</strong> We live in {city} — this community is our home too.</li>\n<li><strong>{warranty}:</strong> Every project backed by our industry-leading warranty.</li>\n</ul>`},
  ]},
  {id:'services',label:'Services Offered',icon:LayoutGrid,description:'Breakdown of specific services with descriptions',variants:[
    {id:'services_a',label:'Variant A — Residential and Commercial',content:`<h2>Our {service} Services in {city}</h2>\n<p>{business_name} offers comprehensive {service} solutions for {city} homeowners and businesses throughout {county} County.</p>\n<h3>Residential Services</h3>\n<p>Homeowners throughout {city} trust {business_name} for reliable {service}. We understand the specific needs of residential properties in {city} and provide solutions that fit your lifestyle and budget of {price_range}.</p>\n<h3>Commercial Services</h3>\n<p>Businesses across {city} rely on {business_name} for professional-grade {service}. We minimize disruption to your operations and deliver efficient solutions on time and on budget.</p>\n<h3>Emergency and Same-Day Service</h3>\n<p>When you need {service} fast in {city}, {business_name} responds quickly. We offer {response_time} service throughout {county} County — because some problems cannot wait.</p>`},
    {id:'services_b',label:'Variant B — Process Focused',content:`<h2>How We Deliver {service} in {city}</h2>\n<h3>Step 1: Free Consultation and Assessment</h3>\n<p>Every project starts with a thorough assessment of your specific situation in {city}. Our experts evaluate your needs and develop a customized plan — at no charge.</p>\n<h3>Step 2: Custom Solution Development</h3>\n<p>Based on your assessment, {business_name} creates a tailored {service} solution designed specifically for your {city} property with transparent pricing of {price_range}.</p>\n<h3>Step 3: Professional Implementation</h3>\n<p>Our certified team executes your project with precision using premium materials and industry-leading techniques. We keep you informed every step of the way.</p>\n<h3>Step 4: Follow-Up and Support</h3>\n<p>After completion, {business_name} follows up to ensure you are fully satisfied. Our {warranty} means we stand behind every job in {city}.</p>`},
  ]},
  {id:'local',label:'Local Area Focus',icon:Globe,description:'Hyperlocal content referencing the specific city and area',variants:[
    {id:'local_a',label:'Variant A — Community Focus',content:`<h2>{service} Across {city} and {county} County</h2>\n<p>{business_name} is proud to be a trusted local resource for {service} in {city}. As a locally focused business, we understand the {city} community — {unique_fact} — and bring that knowledge to every project.</p>\n<p>We serve all neighborhoods throughout {city}, including areas near {local_landmark} and surrounding communities. Whether you are in {neighborhood} or anywhere in {county} County, {business_name} is just a call away.</p>\n<p>Beyond {city}, we also serve {nearby_city_1}, {nearby_city_2}, and {nearby_city_3} — bringing the same level of excellence to every community in our {service_radius} service area.</p>`},
    {id:'local_b',label:'Variant B — Market Authority',content:`<h2>Serving {city} and the Greater {county} County Area</h2>\n<p>When {city} residents and businesses need {service}, {business_name} answers the call. Our deep roots in {county} County give us unique insight into what local clients need — and how to deliver it better than out-of-area competitors.</p>\n<p>{city} is a thriving community with a population of {population}. {business_name} brings exactly the right local expertise to every {service} project — understanding challenges like {local_problem} and solving them with {local_solution}.</p>\n<p>Our {service_radius} service area covers {city} and extends to {nearby_city_1}, {nearby_city_2}, {nearby_city_3}, and communities throughout {county} County and {state_full}.</p>`},
  ]},
  {id:'faq',label:'FAQ Block',icon:HelpCircle,description:'AEO-optimized FAQ with schema markup for AI search',variants:[
    {id:'faq_a',label:'FAQ Set A — Cost and Trust',content:`<h2>Frequently Asked Questions About {service} in {city}</h2>\n<div class="koto-faq" itemscope itemtype="https://schema.org/FAQPage">\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">How much does {service} cost in {city}, {state}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">The cost of {service} in {city} varies based on scope and your specific needs. {business_name} offers free estimates with transparent pricing of {price_range} for the {county} County area. Contact us for your free quote.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">Is {business_name} licensed and insured for {service} in {state}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Yes. {business_name} is fully licensed, bonded, and insured to provide {service} in {state_full}. License: {license_number}. Our team holds all required certifications and stays current with local codes.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">How quickly can {business_name} respond in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">We offer {response_time} service throughout {city} and {county} County. Most inquiries receive same-day or next-day appointments. For urgent needs we accommodate emergency requests as quickly as possible.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What areas near {city} do you serve?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{business_name} serves {city} and surrounding communities including {nearby_city_1}, {nearby_city_2}, and {nearby_city_3} throughout {county} County. Our service radius covers {service_radius} from {city}, {state}.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">Do you offer financing for {service} in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Yes. {business_name} offers {financing} for qualified {city} customers. We accept {payment_methods}. Contact us to learn more about flexible payment options for your {service} project.</p></div></div>\n</div>`},
    {id:'faq_b',label:'FAQ Set B — Value and Results',content:`<h2>Common Questions About {service} in {city}</h2>\n<div class="koto-faq" itemscope itemtype="https://schema.org/FAQPage">\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">Why should I choose {business_name} for {service} in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{business_name} combines local expertise, certified professionals, transparent pricing, and a proven track record in {city}. With {review_count} satisfied clients and a {rating}-star rating, we are {city}'s most trusted {service} provider. Locally owned, fully insured, and committed to results that exceed expectations.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What is your warranty on {service} work in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{business_name} stands behind every project with our {warranty}. If you are not completely satisfied with our {service} in {city}, we will make it right — that is our {guarantee} to every client in {county} County.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What do {city} customers say about {business_name}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{testimonial} — {testimonial_author}. With {review_count} reviews and a {rating}-star rating, {city} customers consistently praise our professionalism, quality, and value. Check our Google Business Profile to read real reviews from your neighbors.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">What makes {city} unique for {service}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">{city}, {state_full} has unique characteristics — {local_problem} is a common local challenge. {business_name} understands these local factors and uses {local_solution} to deliver {service} perfectly suited to the {city} environment.</p></div></div>\n<div class="koto-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><h3 itemprop="name">How do I get started with {service} in {city}?</h3><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Getting started is easy. Call us at {phone} or fill out our online form. We assess your needs, provide a detailed quote, and can often begin within days. {business_name} makes {service} in {city} simple and stress-free.</p></div></div>\n</div>`},
  ]},
  {id:'cta',label:'Call to Action',icon:Send,description:'Closing section driving phone calls and form submissions',variants:[
    {id:'cta_a',label:'Variant A — Urgency CTA',content:`<h2>Ready for Expert {service} in {city}? Contact {business_name} Today</h2>\n<p>Do not settle for less when it comes to {service} in {city}. {business_name} delivers the professional results you deserve — backed by our {guarantee} and {warranty}.</p>\n<p><strong>Call us now: <a href="tel:{phone}">{phone}</a></strong></p>\n<p>We serve all of {city}, {county} County, and surrounding areas including {nearby_city_1}, {nearby_city_2}, and {nearby_city_3}. {call_to_action} — your free consultation is just one call away.</p>\n<p>{seasonal_hook} There has never been a better time to invest in quality {service} for your {city} property.</p>`},
    {id:'cta_b',label:'Variant B — Trust CTA',content:`<h2>{service} in {city} — {business_name} Is Here to Help</h2>\n<p>Join {review_count} satisfied clients throughout {city} and {county} County who trust {business_name} for their {service} needs. Our {rating}-star rating speaks for itself — and our {guarantee} means you have nothing to lose.</p>\n<p><strong>Call: <a href="tel:{phone}">{phone}</a> | Email: <a href="mailto:{email}">{email}</a></strong></p>\n<p>{business_name} — {city}'s trusted {service} provider since {founded}. Serving {city}, {nearby_city_1}, {nearby_city_2}, {nearby_city_3} and all of {county} County, {state_full} {zip}.</p>`},
  ]},
]

function fillWildcards(text,values){
  let r=text
  Object.entries(values).forEach(([k,v])=>{r=r.replace(new RegExp(k.replace(/[{}]/g,'\\$&'),'g'),v||k)})
  return r
}

function AccordionModule({module,wildcardValues,onEditVariant,onSelectVariant,selectedVariants}){
  const [open,setOpen]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [editContent,setEditContent]=useState('')
  const Icon=module.icon||FileText
  return(
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden',marginBottom:10}}>
      <div onClick={()=>setOpen(p=>!p)} style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',borderBottom:open?'1px solid #f3f4f6':'none'}}>
        <div style={{width:36,height:36,borderRadius:10,background:R+'12',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon size={16} color={R}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:FH,fontSize:14,fontWeight:700,color:BLK}}>{module.label}</div>
          <div style={{fontSize:12,color:'#9ca3af',fontFamily:FB}}>{module.description} · {module.variants.length} variants</div>
        </div>
        <span style={{fontSize:11,fontWeight:700,color:T,fontFamily:FH,background:T+'15',padding:'3px 10px',borderRadius:20}}>{module.variants.length} variants</span>
        {open?<ChevronDown size={16} color="#9ca3af"/>:<ChevronRight size={16} color="#9ca3af"/>}
      </div>
      {open&&(
        <div style={{padding:'12px 18px'}}>
          {module.variants.map(variant=>{
            const isSelected=selectedVariants[module.id]===variant.id
            const isEditing=editingId===variant.id
            const filled=fillWildcards(variant.content,wildcardValues)
            return(
              <div key={variant.id} style={{marginBottom:12,border:`1.5px solid ${isSelected?R:'#e5e7eb'}`,borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'10px 14px',background:isSelected?R+'08':'#fafafa',display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>onSelectVariant(module.id,variant.id)}
                    style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${isSelected?R:'#d1d5db'}`,background:isSelected?R:'#fff',flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {isSelected&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}
                  </button>
                  <span style={{fontFamily:FH,fontSize:12,fontWeight:700,color:isSelected?R:BLK,flex:1}}>{variant.label}</span>
                  <button onClick={()=>{setEditingId(isEditing?null:variant.id);setEditContent(variant.content)}}
                    style={{padding:'4px 10px',borderRadius:7,border:'1px solid #e5e7eb',background:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:FH,color:'#6b7280',display:'flex',alignItems:'center',gap:4}}>
                    <Edit2 size={11}/>{isEditing?'Close':'Edit'}
                  </button>
                </div>
                {isEditing&&(
                  <div style={{padding:'12px 14px',borderBottom:'1px solid #f3f4f6',background:'#fffbf5'}}>
                    <div style={{fontSize:11,color:AMB,fontFamily:FH,fontWeight:700,marginBottom:6}}>Editing raw content — use wildcards like city, service</div>
                    <textarea value={editContent} onChange={e=>setEditContent(e.target.value)}
                      style={{width:'100%',height:160,padding:'10px',borderRadius:9,border:'1.5px solid #e5e7eb',fontSize:12,fontFamily:'monospace',outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>{onEditVariant(module.id,variant.id,editContent);setEditingId(null)}}
                        style={{padding:'6px 14px',borderRadius:8,border:'none',background:GRN,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:FH}}>Save Changes</button>
                      <button onClick={()=>setEditingId(null)}
                        style={{padding:'6px 14px',borderRadius:8,border:'1px solid #e5e7eb',background:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:FH,color:'#6b7280'}}>Cancel</button>
                    </div>
                  </div>
                )}
                <div style={{padding:'14px',background:'#fff',fontSize:13,fontFamily:FB,color:'#374151',lineHeight:1.7}}
                  dangerouslySetInnerHTML={{__html:filled.replace(/\n/g,'')}}/>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PageBuilderPage(){
  const {agencyId}=useAuth()
  const navigate=useNavigate()
  const [sites,setSites]=useState([])
  const [selectedSite,setSelectedSite]=useState(null)
  const [modules,setModules]=useState(DEFAULT_MODULES)
  const [selectedVariants,setSelectedVariants]=useState({intro:'intro_a',why_us:'why_a',services:'services_a',local:'local_a',faq:'faq_a',cta:'cta_a'})
  const [wildcardValues,setWildcardValues]=useState({'{city}':'Fort Lauderdale','{state}':'FL','{state_full}':'Florida','{county}':'Broward','{zip}':'33301','{region}':'South Florida','{neighborhood}':'Downtown','{business_name}':'Your Business Name','{phone}':'(555) 555-5555','{phone_tracking}':'(555) 555-1234','{email}':'info@yourbusiness.com','{address}':'123 Main St','{website}':'www.yourbusiness.com','{hours}':'Mon-Fri 8am-6pm','{founded}':'2015','{owner_name}':'John Smith','{service}':'Marketing Agency','{service_plural}':'Marketing Agencies','{service_verb}':'marketing services','{keyword}':'marketing agency','{price_range}':'$500-$2,000/mo','{response_time}':'same-day','{year}':'2026','{month}':'April','{review_count}':'150+','{rating}':'4.9','{certifications}':'Google Partner','{unique_fact}':'a vibrant business community','{local_landmark}':'Las Olas Blvd','{call_to_action}':'Get a Free Audit Today','{competitor_1}':'Big Agency Inc','{competitor_2}':'Local SEO Co','{market_position}':'the affordable alternative','{testimonial}':'Best agency we have worked with!','{testimonial_author}':'Jane D., Fort Lauderdale','{nearby_city_1}':'Hollywood','{nearby_city_2}':'Pompano Beach','{nearby_city_3}':'Dania Beach','{service_radius}':'25 miles','{population}':'183,000','{license_number}':'LIC-123456','{warranty}':'2-year warranty','{guarantee}':'100% satisfaction guaranteed','{payment_methods}':'Cash, Card, Financing','{financing}':'0% financing available','{local_problem}':'humidity and salt air damage','{local_solution}':'our weather-resistant solutions','{seasonal_hook}':'With South Florida year-round sunshine,','{geo_lat}':'26.1224','{geo_lng}':'-80.1373'})
  const [deploying,setDeploying]=useState(false)
  const [deployed,setDeployed]=useState(null)
  const [showWildcards,setShowWildcards]=useState(true)

  useEffect(()=>{if(agencyId)loadSites()},[agencyId])

  async function loadSites(){
    const res=await fetch(`/api/wp?agency_id=${agencyId}`)
    const data=await res.json()
    setSites(data.sites||[])
    if(data.sites?.length)setSelectedSite(data.sites[0])
  }

  function buildFinalContent(){
    return modules.map(module=>{
      const variantId=selectedVariants[module.id]
      const variant=module.variants.find(v=>v.id===variantId)||module.variants[0]
      return fillWildcards(variant.content,wildcardValues)
    }).join('\n\n')
  }

  async function deployPreview(){
    if(!selectedSite){toast.error('Select a WordPress site first');return}
    setDeploying(true)
    try{
      const content=buildFinalContent()
      const title=`${wildcardValues['{service}']} in ${wildcardValues['{city}']}, ${wildcardValues['{state}']}`
      const res=await fetch('/api/wp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_content',agency_id:agencyId,site_id:selectedSite.id,title,content,status:'draft',type:'page',focus_keyword:wildcardValues['{keyword}'],meta_desc:`Looking for ${wildcardValues['{service}']} in ${wildcardValues['{city}']}, ${wildcardValues['{state}']}? ${wildcardValues['{business_name}']} provides expert service throughout ${wildcardValues['{county}']} County.`})})
      const data=await res.json()
      if(data.error||!data.data?.id)throw new Error(data.error||'Deploy failed')
      setDeployed(data.data)
      toast.success('Preview page created in WordPress as draft!')
    }catch(e){toast.error(e.message)}
    setDeploying(false)
  }

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:GRY}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:BLK,padding:'16px 28px',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:FH,fontSize:18,fontWeight:800,color:'#fff',letterSpacing:'-.02em'}}>Page Builder</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.35)',fontFamily:FB,marginTop:2}}>Build once · Swap wildcards · Deploy to every city</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {[{n:1,label:'Setup'},{n:2,label:'Build'},{n:3,label:'Deploy'}].map((s,i)=>(
              <div key={s.n} style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:deployed&&s.n===3?GRN:s.n===1||s.n===2?R:'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff',fontFamily:FH}}>
                  {deployed&&s.n===3?'✓':s.n}
                </div>
                <span style={{fontSize:12,color:'#fff',fontFamily:FH,fontWeight:700}}>{s.label}</span>
                {s.n<3&&<ChevronRight size={14} color="rgba(255,255,255,.3)"/>}
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
          {showWildcards&&(
            <div style={{width:280,background:'#fff',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
              <div style={{padding:'14px 16px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontFamily:FH,fontSize:13,fontWeight:800,color:BLK}}>Wildcard Values</div>
                <button onClick={()=>setShowWildcards(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af'}}><X size={14}/></button>
              </div>
              <div style={{padding:'10px 14px',borderBottom:'1px solid #f3f4f6'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#9ca3af',fontFamily:FH,marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em'}}>WordPress Site</div>
                <select value={selectedSite?.id||''} onChange={e=>setSelectedSite(sites.find(s=>s.id===e.target.value))}
                  style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1.5px solid #e5e7eb',fontSize:12,fontFamily:FB,outline:'none'}}>
                  <option value="">Select site...</option>
                  {sites.map(s=><option key={s.id} value={s.id}>{s.site_name||s.site_url}</option>)}
                </select>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'10px 14px'}}>
                {WILDCARDS.map(wc=>(
                  <div key={wc.key} style={{marginBottom:8}}>
                    <label style={{fontSize:10,fontWeight:700,color:'#9ca3af',fontFamily:FH,display:'block',marginBottom:3,textTransform:'uppercase',letterSpacing:'.05em'}}>
                      {wc.label} <span style={{fontSize:9,color:T,fontFamily:'monospace'}}>{wc.key}</span>
                    </label>
                    <input value={wildcardValues[wc.key]||''} onChange={e=>setWildcardValues(p=>({...p,[wc.key]:e.target.value}))}
                      placeholder={wc.example}
                      style={{width:'100%',padding:'6px 9px',borderRadius:7,border:'1.5px solid #e5e7eb',fontSize:12,fontFamily:FB,outline:'none',boxSizing:'border-box'}}/>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
            {!showWildcards&&(
              <button onClick={()=>setShowWildcards(true)}
                style={{marginBottom:16,padding:'7px 14px',borderRadius:9,border:'1px solid #e5e7eb',background:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:FH,color:'#6b7280',display:'flex',alignItems:'center',gap:6}}>
                <Settings size={13}/> Show Wildcards Panel
              </button>
            )}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{fontFamily:FH,fontSize:16,fontWeight:800,color:BLK}}>Content Modules</div>
                <div style={{fontSize:12,color:'#9ca3af',fontFamily:FB}}>Expand each module · select a variant · edit if needed · deploy preview</div>
              </div>
              <button onClick={deployPreview} disabled={deploying||!selectedSite}
                style={{padding:'9px 18px',borderRadius:10,border:'none',background:T,color:'#fff',fontSize:13,fontWeight:700,cursor:!selectedSite||deploying?'not-allowed':'pointer',fontFamily:FH,display:'flex',alignItems:'center',gap:7,opacity:!selectedSite?0.5:1}}>
                {deploying?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Eye size={14}/>}
                Deploy Preview Page
              </button>
            </div>
            {modules.map(module=>(
              <AccordionModule key={module.id} module={module} wildcardValues={wildcardValues}
                onEditVariant={(mid,vid,content)=>{setModules(prev=>prev.map(m=>m.id===mid?{...m,variants:m.variants.map(v=>v.id===vid?{...v,content}:v)}:m));toast.success('Variant saved')}}
                onSelectVariant={(mid,vid)=>setSelectedVariants(p=>({...p,[mid]:vid}))}
                selectedVariants={selectedVariants}/>
            ))}
            {deployed&&(
              <div style={{background:'#fff',borderRadius:14,border:`2px solid ${GRN}`,padding:'20px',marginTop:10}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div style={{width:36,height:36,borderRadius:10,background:GRN+'15',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Check size={18} color={GRN}/>
                  </div>
                  <div>
                    <div style={{fontFamily:FH,fontSize:14,fontWeight:800,color:BLK}}>Preview Page Created in WordPress!</div>
                    <div style={{fontSize:12,color:'#6b7280',fontFamily:FB}}>Review the draft in WordPress, approve the content, then deploy to all cities</div>
                  </div>
                  {deployed.url&&<a href={deployed.url} target="_blank" rel="noreferrer"
                    style={{marginLeft:'auto',padding:'7px 14px',borderRadius:9,border:`1px solid ${GRN}`,color:GRN,textDecoration:'none',fontSize:12,fontWeight:700,fontFamily:FH,display:'flex',alignItems:'center',gap:5}}>
                    <Eye size={12}/> View in WordPress
                  </a>}
                </div>
                <div style={{fontFamily:FH,fontSize:13,fontWeight:700,color:BLK,marginBottom:8}}>Happy with the content? Deploy to all your target cities:</div>
                <button onClick={()=>navigate('/wordpress')}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:R,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:FH,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  <Globe size={15}/> Go to WordPress Control Center to Deploy All Cities
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
