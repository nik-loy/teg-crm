import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIRequestFactory
from crm.contacts.views import EventViewSet, LoginView

pytestmark = pytest.mark.django_db

@patch("crm.contacts.views.Event.objects.all")
def test_event_viewset_list_mocked(mock_all):
    mock_qs = MagicMock()
    mock_all.return_value = mock_qs
    
    factory = APIRequestFactory()
    request = factory.get("/api/events/")
    
    view = EventViewSet.as_view({"get": "list"})
    response = view(request)
    
    assert response.status_code == 200
    mock_all.assert_called_once()

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
