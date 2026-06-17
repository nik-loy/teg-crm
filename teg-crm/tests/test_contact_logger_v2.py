"""Tests for extended contact_logger — status, owner, accept flags."""
import pytest
from crm.contacts.models import Contact
from src.linkedin.contact_logger import create_contact, find_by_linkedin_url, update_contact_status

pytestmark = pytest.mark.django_db


def test_create_contact_includes_outreach_status():
    contact = create_contact(
        name="Test User",
        linkedin_url="https://linkedin.com/in/test",
        outreach_status="Request Sent",
        outreach_owner="niklas",
    )
    assert contact.name == "Test User"
    assert contact.linkedin_url == "https://linkedin.com/in/test"
    assert contact.outreach_status == "Request Sent"
    assert contact.outreach_owner == "niklas"


def test_update_contact_status():
    contact = Contact.objects.create(
        name="Test User",
        linkedin_url="https://linkedin.com/in/test2",
        outreach_status="Request Sent",
    )
    update_contact_status(contact, "Connected")
    contact.refresh_from_db()
    assert contact.outreach_status == "Connected"


def test_find_by_linkedin_url():
    contact = Contact.objects.create(
        name="Test User",
        linkedin_url="https://linkedin.com/in/test3",
    )
    found = find_by_linkedin_url("https://linkedin.com/in/test3")
    assert found is not None
    assert found.id == contact.id

    not_found = find_by_linkedin_url("https://linkedin.com/in/nonexistent")
    assert not_found is None
