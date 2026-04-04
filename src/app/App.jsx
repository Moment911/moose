"use client"
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { MobileMenuProvider } from '../context/MobileMenuContext'
import { AuthProvider } from '../hooks/useAuth'

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
import AdminPortalPage from '../views/AdminPortalPage'
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
import ScoutPage from '../views/scout/ScoutPage'
import ScoutLeadsPage from '../views/scout/ScoutLeadsPage'
import ScoutSavedPage from '../views/scout/ScoutSavedPage'
import CompanyProfilePage from '../views/scout/CompanyProfilePage'
import ScoutReportsPage from '../views/scout/ScoutReportsPage'
import ScoutSettingsPage from '../views/scout/ScoutSettingsPage'
import SEOHubPage from '../views/seo/SEOHubPage'
import SEOAuditPage from '../views/seo/SEOAuditPage'
import SEOPluginPage from '../views/seo/SEOPluginPage'
import SEOConnectPage from '../views/seo/SEOConnectPage'
import WordPressPage from '../views/WordPressPage'
import SettingsPage from '../views/SettingsPage'
import ClientDetailPage from '../views/ClientDetailPage'
import OnboardingPage from '../views/OnboardingPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <MobileMenuProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:clientId" element={<ClientDetailPage />} />
          <Route path="/onboard/:token" element={<OnboardingPage />} />
          <Route path="/onboarding/:token" element={<OnboardingPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/client/:clientId" element={<DashboardPage />} />
          <Route path="/project/:projectId" element={<ProjectPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/builder" element={<CampaignBuilderPage />} />
          <Route path="/campaigns/builder/:campaignId" element={<CampaignBuilderPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/employees" element={<EmployeePage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/admin" element={<AdminPortalPage />} />
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
          <Route path="/scout" element={<ScoutPage />} />
          <Route path="/scout/leads" element={<ScoutLeadsPage />} />
          <Route path="/scout/saved" element={<ScoutSavedPage />} />
          <Route path="/scout/company/:id" element={<CompanyProfilePage />} />
          <Route path="/scout/reports" element={<ScoutReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/scout/settings" element={<SettingsPage />} />
          <Route path="/seo" element={<SEOHubPage />} />
          <Route path="/seo/audit" element={<SEOAuditPage />} />
          <Route path="/seo/plugin" element={<SEOPluginPage />} />
          <Route path="/seo/connect" element={<SEOConnectPage />} />
          <Route path="/wordpress" element={<WordPressPage />} />
        </Routes>
      </MobileMenuProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
