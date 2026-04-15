'use client'

import { Dispatch } from 'react'
import { CompanyProfile, KotoFinAction } from './KotoFin.types'
import { Building2, MapPin, Phone, Globe, Briefcase, User, Calculator } from 'lucide-react'
import styles from './KotoFinPro.module.css'

interface CompanyInfoTabProps {
  companyProfile: CompanyProfile
  dispatch: Dispatch<KotoFinAction>
  clientName: string
}

export default function CompanyInfoTab({ companyProfile, dispatch, clientName }: CompanyInfoTabProps) {
  function update(partial: Partial<CompanyProfile>) {
    dispatch({ type: 'SET_COMPANY_PROFILE', payload: partial })
  }

  return (
    <div>
      {/* Business Identity */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} /> Business Identity
          </span>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Legal Business Name</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.businessName || clientName} onChange={e => update({ businessName: e.target.value })} placeholder="Acme Marketing LLC" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>DBA / Trade Name</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.dba} onChange={e => update({ dba: e.target.value })} placeholder="Acme Marketing" />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>EIN (Employer ID Number)</label>
            <input className={`${styles.input} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.ein} onChange={e => update({ ein: e.target.value })} placeholder="XX-XXXXXXX" maxLength={10} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Year Established</label>
            <input className={`${styles.input} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.yearEstablished} onChange={e => update({ yearEstablished: e.target.value })} placeholder="2020" maxLength={4} />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Industry</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.industry} onChange={e => update({ industry: e.target.value })} placeholder="Marketing & Advertising" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>NAICS Code (optional)</label>
            <input className={`${styles.input} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.naicsCode} onChange={e => update({ naicsCode: e.target.value })} placeholder="541810" maxLength={6} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} /> Business Address
          </span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Street Address</label>
          <input className={styles.input} style={{ width: '100%' }} value={companyProfile.address} onChange={e => update({ address: e.target.value })} placeholder="123 Main St, Suite 100" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>City</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.city} onChange={e => update({ city: e.target.value })} placeholder="Los Angeles" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>State</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.state} onChange={e => update({ state: e.target.value })} placeholder="CA" maxLength={2} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>ZIP</label>
            <input className={`${styles.input} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.zip} onChange={e => update({ zip: e.target.value })} placeholder="90210" maxLength={10} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={16} /> Contact Information
          </span>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Business Phone</label>
            <input className={`${styles.input} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.phone} onChange={e => update({ phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Business Email</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.email} onChange={e => update({ email: e.target.value })} placeholder="accounting@company.com" />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Website</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={14} color="var(--text-dim)" />
            <input className={styles.input} style={{ flex: 1 }} value={companyProfile.website} onChange={e => update({ website: e.target.value })} placeholder="https://company.com" />
          </div>
        </div>
      </div>

      {/* Owner / Principal */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} /> Owner / Principal
          </span>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Owner Full Name</label>
            <input className={styles.input} style={{ width: '100%' }} value={companyProfile.ownerName} onChange={e => update({ ownerName: e.target.value })} placeholder="John Smith" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>SSN Last 4 (for Schedule C)</label>
            <input className={`${styles.input} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.ownerSSNLast4} onChange={e => update({ ownerSSNLast4: e.target.value })} placeholder="••••" maxLength={4} type="password" />
          </div>
        </div>
      </div>

      {/* Accounting */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={16} /> Accounting Settings
          </span>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Accounting Method</label>
            <select className={styles.select} style={{ width: '100%' }} value={companyProfile.accountingMethod} onChange={e => update({ accountingMethod: e.target.value as 'cash' | 'accrual' })}>
              <option value="cash">Cash Basis</option>
              <option value="accrual">Accrual Basis</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              Most small businesses use cash basis. Once chosen, IRS approval is needed to change (Form 3115).
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tax Year</label>
            <select className={`${styles.select} ${styles.inputMono}`} style={{ width: '100%' }} value={companyProfile.taxYear} onChange={e => update({ taxYear: e.target.value })}>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2023">2023</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Fiscal Year End Month</label>
          <select className={styles.select} style={{ width: '100%' }} value={companyProfile.fiscalYearEnd} onChange={e => update({ fiscalYearEnd: e.target.value })}>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
              <option key={i} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            Most sole proprietors and S-Corps must use calendar year (December). C-Corps can choose any fiscal year end.
          </div>
        </div>
      </div>
    </div>
  )
}
