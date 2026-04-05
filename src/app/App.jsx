"use client"
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { MobileMenuProvider } from '../context/MobileMenuContext'
import MobileShell from '../components/mobile/MobileShell'
import { AuthProvider } from '../hooks/useAuth'
import { ClientProvider } from '../context/ClientContext'

import LoginPage from '../views/LoginPage'
import ClientsPage from '../views/ClientsPage'
import DashboardPage from '../views/DashboardPage'
import ProjectPage from '../views/ProjectPage'
import MessagesPage from '../views/MessagesPage'
import TasksPage from '../views/TasksPage'
import TaskDetailPage from '../views/TaskDetailPage'
import CalendarPage from '../views/CalendarPage'
import MarketingPage from '../views/MarketingPage'
import CampaignsPage from '../views/CampaignsPage'
import CampaignBuilderPage from '../views/CampaignBuilderPage'
import RevenuePage from '../views/RevenuePage'
import EmployeePage from '../views/EmployeePage'
import IntegrationsPage from '../views/IntegrationsPage'
import { useEffect } from 'react'
import AdminPortalPage from '../views/AdminPortalPage'
import MasterAdminPage from '../views/MasterAdminPage'
import KotoSuperAdminPage from '../views/KotoSuperAdminPage'
import RequireAuth from '../components/RequireAuth'
import ImpersonationBanner from '../components/ImpersonationBanner'
import AgencyControlPanel from '../components/AgencyControlPanel'
import BrandGuidelinesPage from '../views/BrandGuidelinesPage'
import TemplatesPage from '../views/TemplatesPage'
import ContactsPage from '../views/ContactsPage'
import ContactProfilePage from '../views/ContactProfilePage'
import ListsPage from '../views/ListsPage'
import EmailDesignerPage from '../views/EmailDesignerPage'
import AutomationsPage from '../views/AutomationsPage'
import PublicReviewPage from '../views/PublicReviewPage'
import ReviewPage from '../views/ReviewPage'
import ClientDashboardPage from '../views/ClientDashboardPage'
import ClientAuthPage from '../views/ClientAuthPage'
import WireframePage from '../views/WireframePage'
import ESignaturePage from '../views/ESignaturePage'
import PrivacyPolicyPage from '../views/PrivacyPolicyPage'
import TermsPage from '../views/TermsPage'
import ScoutPage from '../views/scout/ScoutPage'
import ScoutHistoryPage from '../views/scout/ScoutHistoryPage'
import KotoDeskPage from '../views/desk/MooseDeskPage'
import DeskTicketPage from '../views/desk/DeskTicketPage'
import DeskSettingsPage from '../views/desk/DeskSettingsPage'
import DeskAnalyticsPage from '../views/desk/DeskAnalyticsPage'
import QAKnowledgePage from '../views/desk/QAKnowledgePage'
import DeskReportsPage from '../views/desk/DeskReportsPage'
import PerfDashboard from '../views/perf/PerfDashboard'
import ProspectReportPage from '../views/scout/ProspectReportPage'
import PublicReportPage from '../views/scout/PublicReportPage'
import ScoutLeadsPage from '../views/scout/ScoutLeadsPage'
import ScoutSavedPage from '../views/scout/ScoutSavedPage'
import CompanyProfilePage from '../views/scout/CompanyProfilePage'
import ScoutReportsPage from '../views/scout/ScoutReportsPage'
import ScoutSettingsPage from '../views/scout/ScoutSettingsPage'
import SEOHubPage from '../views/seo/SEOHubPage'
import LocalRankTrackerPage from '../views/seo/LocalRankTrackerPage'
import SEOAuditPage from '../views/seo/SEOAuditPage'
import GBPAuditPage from '../views/seo/GBPAuditPage'
import OnPageAuditPage from '../views/seo/OnPageAuditPage'
import KeywordGapPage from '../views/seo/KeywordGapPage'
import MonthlyReportPage from '../views/seo/MonthlyReportPage'
import ContentGapPage from '../views/seo/ContentGapPage'
import TechnicalAuditPage from '../views/seo/TechnicalAuditPage'
import AIVisibilityPage from '../views/seo/AIVisibilityPage'
import WhiteLabelReportPage from '../views/seo/WhiteLabelReportPage'
import CompetitorIntelPage from '../views/seo/CompetitorIntelPage'
import CitationTrackerPage from '../views/seo/CitationTrackerPage'
import SEOPluginPage from '../views/seo/SEOPluginPage'
import SEOConnectPage from '../views/seo/SEOConnectPage'
import WordPressPage from '../views/WordPressPage'
import SettingsPage from '../views/SettingsPage'
import ClientDetailPage from '../views/ClientDetailPage'
import OnboardingPage from '../views/OnboardingPage'
import MarketingSitePage from '../views/MarketingSitePage'
import AgencySignupPage from '../views/AgencySignupPage'
import AgencySettingsPage from '../views/AgencySettingsPage'
import DbSetupPage from '../views/DbSetupPage'
import BillingPage from '../views/BillingPage'
import AgentPage from '../views/AgentPage'
import ClientPortalPage from '../views/ClientPortalPage'
import AgencySetupPage from '../views/AgencySetupPage'
import AccountAccessPage from '../views/AccountAccessPage'
import ClientAccessFormPage from '../views/ClientAccessFormPage'
import ClientPersonaPage from '../views/ClientPersonaPage'
import PaymentsPage from '../views/PaymentsPage'
import AIAgentsPage from '../views/AIAgentsPage'
import ReportingPage from '../views/ReportingPage'
import SocialPlannerPage from '../views/SocialPlannerPage'
import ReviewsPage from '../views/ReviewsPage'
import ReviewCampaignsPage from '../views/ReviewCampaignsPage'
import OnboardingDashboardPage from '../views/OnboardingDashboardPage'
import ScoutPipelinePage from '../views/scout/ScoutPipelinePage'
import MarketplacePage from '../views/MarketplacePage'
import WordPressControlPage from '../views/WordPressControlPage'
import ProposalsPage from '../views/ProposalsPage'
import PlatformAdminPage from '../views/PlatformAdminPage'
import ProposalBuilderPage from '../views/ProposalBuilderPage'
import ProposalLibraryPage from '../views/ProposalLibraryPage'
import ProposalPublicPage from '../views/ProposalPublicPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <ClientProvider>
      <MobileMenuProvider>
        <Toaster position="top-right" />
        <MobileShell>
        <ImpersonationBanner/>
        <AgencyControlPanel/>
        <RequireAuth>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/welcome" element={<MarketingSitePage />} />
          <Route path="/signup" element={<AgencySignupPage />} />
          <Route path="/db-setup" element={<DbSetupPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/portal/:token" element={<ClientPortalPage />} />
          <Route path="/portal/preview/:clientId" element={<ClientPortalPage />} />
          <Route path="/agency-settings" element={<AgencySettingsPage />} />
          <Route path="/setup" element={<AgencySettingsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:clientId" element={<ClientDetailPage />} />
          <Route path="/onboard/:token" element={<OnboardingPage />} />
          <Route path="/onboarding/:token" element={<OnboardingPage />} />
          <Route path="/clients/:clientId/access" element={<AccountAccessPage />} />
          <Route path="/access/:token" element={<ClientAccessFormPage />} />
          <Route path="/clients/:clientId/persona" element={<ClientPersonaPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/review-campaigns" element={<ReviewCampaignsPage />} />
          <Route path="/onboarding-dashboard" element={<OnboardingDashboardPage />} />
          <Route path="/scout/pipeline" element={<ScoutPipelinePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/wordpress" element={<WordPressControlPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/proposals/:id" element={<ProposalBuilderPage />} />
          <Route path="/platform" element={<AgencySettingsPage />} />
          <Route path="/p/:token" element={<ProposalPublicPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/client/:clientId" element={<DashboardPage />} />
          <Route path="/project/:projectId" element={<ProjectPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/builder" element={<CampaignBuilderPage />} />
          <Route path="/campaigns/builder/:campaignId" element={<CampaignBuilderPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/employees" element={<EmployeePage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/admin" element={<AdminPortalPage />} />
          <Route path="/master-admin" element={<MasterAdminPage />} />
          <Route path="/koto-admin" element={<KotoSuperAdminPage />} />
          <Route path="/platform-admin" element={<PlatformAdminPage />} />
          <Route path="/brand-guidelines" element={<BrandGuidelinesPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:contactId" element={<ContactProfilePage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/email-designer" element={<EmailDesignerPage />} />
          <Route path="/email-designer/:templateId" element={<EmailDesignerPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/review/:token" element={<PublicReviewPage />} />
          <Route path="/review-internal/:projectId" element={<ReviewPage />} />
          <Route path="/client-portal" element={<ClientDashboardPage />} />
          <Route path="/client-auth" element={<ClientAuthPage />} />
          <Route path="/wireframe" element={<WireframePage />} />
          <Route path="/wireframe/:projectId" element={<WireframePage />} />
          <Route path="/esign/:projectId" element={<ESignaturePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/scout" element={<ScoutPage />} />
          <Route path="/scout/leads" element={<ScoutLeadsPage />} />
          <Route path="/scout/saved" element={<ScoutSavedPage />} />
          <Route path="/scout/company/:id" element={<CompanyProfilePage />} />
          <Route path="/scout/report" element={<ProspectReportPage />} />
          <Route path="/r/:token" element={<PublicReportPage />} />
          <Route path="/scout/reports" element={<ScoutReportsPage />} />
          <Route path="/scout/history" element={<ScoutHistoryPage />} />
          <Route path="/desk" element={<KotoDeskPage />} />
          <Route path="/desk/ticket/:id" element={<DeskTicketPage />} />
          <Route path="/desk/settings" element={<AgencySettingsPage />} />
          <Route path="/desk/analytics" element={<DeskAnalyticsPage />} />
          <Route path="/desk/reports" element={<DeskReportsPage />} />
          <Route path="/desk/knowledge" element={<QAKnowledgePage />} />
          <Route path="/perf" element={<PerfDashboard />} />
          <Route path="/perf/:clientId" element={<PerfDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/scout/settings" element={<SettingsPage />} />
          <Route path="/seo" element={<SEOHubPage />} />
          <Route path="/seo/:clientId" element={<SEOHubPage />} />
          <Route path="/seo/local-rank" element={<LocalRankTrackerPage />} />
          <Route path="/seo/audit" element={<SEOAuditPage />} />
          <Route path="/seo/gbp-audit" element={<GBPAuditPage />} />
          <Route path="/seo/onpage" element={<OnPageAuditPage />} />
          <Route path="/seo/keyword-gap" element={<KeywordGapPage />} />
          <Route path="/seo/monthly-report" element={<MonthlyReportPage />} />
          <Route path="/seo/content-gap" element={<ContentGapPage />} />
          <Route path="/seo/technical-audit" element={<TechnicalAuditPage />} />
          <Route path="/seo/ai-visibility" element={<AIVisibilityPage />} />
          <Route path="/seo/white-label" element={<WhiteLabelReportPage />} />
          <Route path="/seo/competitor-intel" element={<CompetitorIntelPage />} />
          <Route path="/seo/citations" element={<CitationTrackerPage />} />
          <Route path="/seo/plugin" element={<SEOPluginPage />} />
          <Route path="/seo/connect" element={<SEOConnectPage />} />
          <Route path="/wordpress" element={<WordPressPage />} />
        </Routes>
        </RequireAuth>
        </MobileShell>
      </MobileMenuProvider>
      </ClientProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
