"""TEG CRM URL configuration."""

from django.contrib import admin
from django.urls import path
from crm.contacts.views import (
    LoginView,
    EventViewSet,
    TeamMemberViewSet,
    ContactViewSet,
)

# Explicit action mappings for each viewset
event_list = EventViewSet.as_view({"get": "list", "post": "create"})
event_detail = EventViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})
event_attendances = EventViewSet.as_view({"get": "attendances"})

team_member_list = TeamMemberViewSet.as_view({"get": "list", "post": "create"})
team_member_detail = TeamMemberViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})

contact_list = ContactViewSet.as_view({"get": "list", "post": "create"})
contact_detail = ContactViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    
    # Events routes
    path("api/events/", event_list, name="event-list"),
    path("api/events/<int:pk>/", event_detail, name="event-detail"),
    path("api/events/<int:pk>/attendances/", event_attendances, name="event-attendances"),
    
    # Team Members routes
    path("api/team-members/", team_member_list, name="teammember-list"),
    path("api/team-members/<int:pk>/", team_member_detail, name="teammember-detail"),
    
    # Contacts routes
    path("api/contacts/", contact_list, name="contact-list"),
    path("api/contacts/stats/", ContactViewSet.as_view({"get": "stats"}), name="contact-stats"),
    path("api/contacts/enrich/", ContactViewSet.as_view({"post": "enrich"}), name="contact-enrich"),
    path("api/contacts/<int:pk>/", contact_detail, name="contact-detail"),
    path("api/contacts/<int:pk>/generate_message/", ContactViewSet.as_view({"post": "generate_message"}), name="contact-generate-message"),
    path("api/contacts/<int:pk>/save_message/", ContactViewSet.as_view({"post": "save_message"}), name="contact-save-message"),
    path("api/contacts/export/", ContactViewSet.as_view({"get": "export"}), name="contact-export"),
]
