import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIRequestFactory
from crm.contacts.views import EventViewSet, LoginView

pytestmark = pytest.mark.django_db

@patch("crm.contacts.views.EventViewSet.get_queryset")
def test_event_viewset_list_mocked(mock_get_queryset):
    mock_qs = MagicMock()
    mock_get_queryset.return_value = mock_qs
    
    from django.contrib.auth.models import User
    from rest_framework.test import force_authenticate
    
    factory = APIRequestFactory()
    request = factory.get("/api/events/")
    
    user, _ = User.objects.get_or_create(username="TEG")
    force_authenticate(request, user=user)
    
    view = EventViewSet.as_view({"get": "list"})
    response = view(request)
    
    assert response.status_code == 200
    mock_get_queryset.assert_called_once()

def test_login_view_success():
    factory = APIRequestFactory()
    request = factory.post("/api/auth/login/", {"username": "TEG", "password": "TEGmoney"}, format="json")
    
    view = LoginView.as_view()
    response = view(request)
    
    assert response.status_code == 200
    assert "access" in response.data

def test_login_view_failure():
    factory = APIRequestFactory()
    request = factory.post("/api/auth/login/", {"username": "wrong", "password": "wrong"}, format="json")
    
    view = LoginView.as_view()
    response = view(request)
    
    assert response.status_code == 401


from crm.contacts.views import ContactViewSet

@patch("crm.contacts.views.ContactViewSet.get_queryset")
def test_contact_viewset_list(mock_get_queryset):
    mock_qs = MagicMock()
    mock_get_queryset.return_value = mock_qs
    
    from django.contrib.auth.models import User
    from rest_framework.test import force_authenticate
    
    factory = APIRequestFactory()
    request = factory.get("/api/contacts/")
    
    user, _ = User.objects.get_or_create(username="TEG")
    force_authenticate(request, user=user)
    
    view = ContactViewSet.as_view({"get": "list"})
    response = view(request)
    
    assert response.status_code == 200
    mock_get_queryset.assert_called_once()

@patch("crm.contacts.models.Contact.objects")
def test_contact_viewset_stats(mock_objects):
    mock_contacts_qs = MagicMock()
    mock_objects.all.return_value = mock_contacts_qs
    mock_contacts_qs.count.return_value = 10
    
    mock_values_stage = [{"pipeline_stage": "Awareness", "count": 5}]
    mock_values_tier = [{"tier": "Tier 1", "count": 5}]
    mock_values_source = [{"source": "LinkedIn", "count": 5}]
    mock_values_status = [{"outreach_status": "Request Sent", "count": 5}]
    
    mock_annotate = MagicMock()
    mock_contacts_qs.values.return_value = mock_annotate
    mock_annotate.annotate.side_effect = [
        mock_values_stage,
        mock_values_tier,
        mock_values_source,
        mock_values_status,
        [] 
    ]
    
    from django.contrib.auth.models import User
    from rest_framework.test import force_authenticate
    
    factory = APIRequestFactory()
    request = factory.get("/api/contacts/stats/")
    
    user, _ = User.objects.get_or_create(username="TEG")
    force_authenticate(request, user=user)
    
    view = ContactViewSet.as_view({"get": "stats"})
    response = view(request)
    
    assert response.status_code == 200
    assert response.data["total"] == 10
    assert response.data["byStage"]["Awareness"] == 5
    assert response.data["byTier"]["Tier 1"] == 5

