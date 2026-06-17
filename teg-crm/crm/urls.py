"""TEG CRM URL configuration."""

from django.contrib import admin
from django.urls import path, include
from crm.contacts.views import (
    LoginView,
    EventViewSet,
    AttendanceViewSet,
    OutreachDraftViewSet,
    ContactViewSet,
)

# Explicit action mappings for each viewset
event_list = EventViewSet.as_view({"get": "list", "post": "create"})
event_detail = EventViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
event_import = EventViewSet.as_view({"post": "import_leads"})
event_attendances = EventViewSet.as_view({"get": "attendances"})
event_drafts = EventViewSet.as_view({"get": "drafts"})

attendance_list = AttendanceViewSet.as_view({"get": "list"})
attendance_detail = AttendanceViewSet.as_view({"get": "retrieve"})
attendance_generate_message = AttendanceViewSet.as_view({"post": "generate_message"})

draft_list = OutreachDraftViewSet.as_view({"get": "list", "post": "create"})
draft_detail = OutreachDraftViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})

contact_list = ContactViewSet.as_view({"get": "list", "post": "create"})
contact_stats = ContactViewSet.as_view({"get": "stats"})
contact_extract_profile = ContactViewSet.as_view({"post": "extract_profile"})
contact_detail = ContactViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    
    # Events routes
    path("api/events/", event_list, name="event-list"),
    path("api/events/<slug:slug>/", event_detail, name="event-detail"),
    path("api/events/<slug:slug>/import_leads/", event_import, name="event-import-leads"),
    path("api/events/<slug:slug>/attendances/", event_attendances, name="event-attendances"),
    path("api/events/<slug:slug>/drafts/", event_drafts, name="event-drafts"),
    
    # Attendances routes
    path("api/attendances/", attendance_list, name="attendance-list"),
    path("api/attendances/<int:pk>/", attendance_detail, name="attendance-detail"),
    path("api/attendances/<int:pk>/generate_message/", attendance_generate_message, name="attendance-generate-message"),
    
    # Drafts routes
    path("api/drafts/", draft_list, name="draft-list"),
    path("api/drafts/<int:pk>/", draft_detail, name="draft-detail"),
    
    # Contacts routes
    path("api/contacts/", contact_list, name="contact-list"),
    path("api/contacts/stats/", contact_stats, name="contact-stats"),
    path("api/contacts/extract_profile/", contact_extract_profile, name="contact-extract-profile"),
    path("api/contacts/<int:pk>/", contact_detail, name="contact-detail"),
]
