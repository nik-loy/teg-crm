"""TEG CRM URL configuration."""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from crm.contacts.views import LoginView, EventViewSet, AttendanceViewSet, OutreachDraftViewSet

router = DefaultRouter()
router.register(r"events", EventViewSet, basename="event")
router.register(r"attendances", AttendanceViewSet, basename="attendance")
router.register(r"drafts", OutreachDraftViewSet, basename="draft")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/", include(router.urls)),
]
