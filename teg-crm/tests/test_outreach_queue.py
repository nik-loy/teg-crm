"""Tests for outreach queue grouping logic."""
from datetime import date, timedelta
import pytest
from crm.contacts.models import Contact
from src.linkedin.outreach_queue import group_by_status, get_stale_requests

pytestmark = pytest.mark.django_db


def test_group_contacts_by_status():
    contacts = [
        Contact.objects.create(name="Alice", linkedin_url="url1", outreach_status="Request Sent"),
        Contact.objects.create(name="Bob", linkedin_url="url2", outreach_status="Connected"),
        Contact.objects.create(name="Clara", linkedin_url="url3", outreach_status="Messaged"),
        Contact.objects.create(name="David", linkedin_url="url4", outreach_status=""),
    ]
    groups = group_by_status(contacts)
    assert len(groups["Request Sent"]) == 1
    assert len(groups["Connected"]) == 1
    assert len(groups["Messaged"]) == 1
    assert len(groups["No Status"]) == 1
    assert groups["Request Sent"][0].name == "Alice"
    assert groups["Connected"][0].name == "Bob"
    assert groups["Messaged"][0].name == "Clara"
    assert groups["No Status"][0].name == "David"


def test_stale_requests_flagged():
    old_alice = Contact.objects.create(name="Old Alice", linkedin_url="url1", outreach_status="Request Sent")
    Contact.objects.filter(id=old_alice.id).update(created_at=date.today() - timedelta(days=5))
    old_alice.refresh_from_db()

    recent_bob = Contact.objects.create(name="Recent Bob", linkedin_url="url2", outreach_status="Request Sent")
    Contact.objects.filter(id=recent_bob.id).update(created_at=date.today() - timedelta(days=1))
    recent_bob.refresh_from_db()

    contacts = [old_alice, recent_bob]
    stale = get_stale_requests(contacts, stale_after_days=3)
    assert len(stale) == 1
    assert stale[0].name == "Old Alice"
