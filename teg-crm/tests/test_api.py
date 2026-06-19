import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User
from crm.contacts.models import Contact, Event, TeamMember, RawProfileData, Rating

@pytest.fixture
def api_client():
    client = APIClient()
    user = User.objects.create_user(username="testuser", password="testpassword")
    client.force_authenticate(user=user)
    return client

@pytest.fixture
def setup_data():
    tm = TeamMember.objects.create(name="Test Owner")
    event = Event.objects.create(
        name="Test Event",
        outreach_prompt="Test outreach prompt",
        fit_scoring_prompt="Test fit prompt"
    )
    contact = Contact.objects.create(
        name="Test User",
        linkedin_url="https://linkedin.com/in/testuser",
        follow_up_owner=tm
    )
    return tm, event, contact

@pytest.mark.django_db
def test_contact_list(api_client, setup_data):
    tm, event, contact = setup_data
    response = api_client.get(reverse('contact-list'))
    assert response.status_code == status.HTTP_200_OK
    assert len(response.data['results']) == 1
    assert response.data['results'][0]['name'] == "Test User"

@pytest.mark.django_db
def test_contact_enrich_not_found(api_client, setup_data):
    tm, event, contact = setup_data
    payload = {
        "raw_text": "Unknown User\nSome title\nSome other text"
    }
    response = api_client.post(reverse('contact-enrich'), data=payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "not found" in response.data['error']

@pytest.mark.django_db
def test_contact_enrich_success(api_client, setup_data, mocker):
    tm, event, contact = setup_data
    
    # Mock threading to run synchronously for tests
    mocker.patch('threading.Thread.start', side_effect=lambda: None)
    
    payload = {
        "raw_text": "Test User\nTitle\nMunich"
    }
    response = api_client.post(reverse('contact-enrich'), data=payload, format='json')
    assert response.status_code == status.HTTP_200_OK
    
    contact.refresh_from_db()
    assert hasattr(contact, 'raw_profile_data')
    assert contact.raw_profile_data.raw_text == "Test User\nTitle\nMunich"

@pytest.mark.django_db
def test_contact_generate_message(api_client, setup_data, mocker):
    tm, event, contact = setup_data
    
    # Create RawProfileData and Rating
    RawProfileData.objects.create(contact=contact, raw_text="Profile data")
    Rating.objects.create(contact=contact, score=4, reason="Good fit")
    
    # Mock Gemini response
    class MockResponse:
        text = '["Message 1", "Message 2", "Message 3"]'
    
    mock_genai = mocker.patch('google.genai.Client')
    mock_client_instance = mock_genai.return_value
    mock_client_instance.models.generate_content.return_value = MockResponse()
    
    # Mock env vars
    mocker.patch('src.config.Config.from_env', return_value=mocker.Mock(gemini_api_key='testkey'))

    response = api_client.post(reverse('contact-generate-message', args=[contact.id]), format='json')
    assert response.status_code == status.HTTP_200_OK
    assert "variants" in response.data
    assert len(response.data["variants"]) == 3
    
    contact.refresh_from_db()
    assert contact.follow_up_complete is True

