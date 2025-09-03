import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import OrderHistoryManagement from './pages/order-history-management';
import ExpenseReportsAnalytics from './pages/expense-reports-analytics';
import LoginRegistration from './pages/login-registration';
import MealPollingSystem from './pages/meal-polling-system';
import DashboardHome from './pages/dashboard-home';
import CalendarOrderScheduling from './pages/calendar-order-scheduling';
import TeamSetup from './pages/team-setup';
import TeamMembersManagement from './pages/team-members-management';
import SavedAddressesLocations from './pages/saved-addresses-locations';
import PaymentMethodsBilling from './pages/payment-methods-billing';
import TermsConditoins from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AwaitingEmailVerificationPage from "pages/awaiting-email-verification";
import ResetPassword from 'pages/reset-password';
import HomeRestaurantDiscovery from './pages/home-restaurant-discovery';
import RestaurantDetailMenu from './pages/restaurant-detail-menu';
import ShoppingCartCheckout from './pages/shopping-cart-checkout';
import SharedCartPage from './pages/shared-cart';

import SharedCartProvider from './contexts/SharedCartContext';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={<DashboardHome />} />
        <Route path="/order-history-management" element={<OrderHistoryManagement />} />
        <Route path="/expense-reports-analytics" element={<ExpenseReportsAnalytics />} />
        <Route path="/login-registration" element={<LoginRegistration />} />
        <Route path="/meal-polling-system" element={<MealPollingSystem />} />
        <Route path="/dashboard-home" element={<DashboardHome />} />
        <Route path="/calendar-order-scheduling" element={<CalendarOrderScheduling />} />
        <Route path="/team-setup" element={<TeamSetup />} />
        <Route path="/team-members-management" element={<TeamMembersManagement />} />
        <Route path="/saved-addresses-locations" element={<SavedAddressesLocations />} />
        <Route path="/payment-methods-billing" element={<PaymentMethodsBilling />} />
        <Route path="/terms-and-conditions" element={<TermsConditoins />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/awaiting-email-verification" element={<AwaitingEmailVerificationPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/home-restaurant-discovery" element={<HomeRestaurantDiscovery />} />
        <Route path="/restaurant-detail-menu" element={<RestaurantDetailMenu />} />
        <Route path="/shopping-cart-checkout" element={<ShoppingCartCheckout />} />
        <Route path="/shared-cart/:shareToken" element={<SharedCartPage />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;