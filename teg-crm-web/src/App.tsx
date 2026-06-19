import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./pages/layout";

import DashboardPage from "./pages/dashboard";
import EventsPage from "./pages/events";
import EventDetailPage from "./pages/events/[slug]";
import ContactsPage from "./pages/contacts";
import TodayPage from "./pages/today";
import MessagesPage from "./pages/messages";
import MessageDetailPage from "./pages/messages/[contactId]";
import PendingRequestsPage from "./pages/pending-requests";
import EnrichmentPage from "./pages/enrichment";
import LoginPage from "./pages/login";

// Add a simple RequireAuth wrapper
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("teg_jwt");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Authenticated routes */}
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/dashboard" element={<LayoutWrapper><DashboardPage /></LayoutWrapper>} />
        <Route path="/events" element={<LayoutWrapper><EventsPage /></LayoutWrapper>} />
        <Route path="/events/:slug" element={<LayoutWrapper><EventDetailPage /></LayoutWrapper>} />
        <Route path="/contacts/*" element={<LayoutWrapper><ContactsPage /></LayoutWrapper>} />
        <Route path="/today" element={<LayoutWrapper><TodayPage /></LayoutWrapper>} />
        <Route path="/messages" element={<LayoutWrapper><MessagesPage /></LayoutWrapper>} />
        <Route path="/messages/:contactId" element={<LayoutWrapper><MessageDetailPage /></LayoutWrapper>} />
        <Route path="/pending-requests" element={<LayoutWrapper><PendingRequestsPage /></LayoutWrapper>} />
        <Route path="/enrichment" element={<LayoutWrapper><EnrichmentPage /></LayoutWrapper>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
