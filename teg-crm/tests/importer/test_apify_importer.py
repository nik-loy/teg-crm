import pytest
from io import StringIO
from django.core.files.uploadedfile import SimpleUploadedFile
from crm.contacts.models import Contact, Event, Attendance
from src.importer.apify_importer import import_apify_csv

pytestmark = pytest.mark.django_db

def test_import_apify_csv_creates_contacts_and_attendances():
    event = Event.objects.create(name="Test Event", slug="test-event")
    
    csv_content = """fullName,headline,company,linkedinUrl,about,experience
John Doe,CEO,Acme Corp,https://linkedin.com/in/johndoe,A great CEO,10 years
Jane Smith,CTO,Tech Inc,https://linkedin.com/in/janesmith,A great CTO,8 years
"""
    file_obj = SimpleUploadedFile("test.csv", csv_content.encode("utf-8"))
    
    count = import_apify_csv(file_obj, event)
    
    assert count == 2
    assert Contact.objects.count() == 2
    assert Attendance.objects.count() == 2
    
    john = Contact.objects.get(name="John Doe")
    assert john.company_name == "Acme Corp"
    assert john.job_title == "CEO"
    
    attendance = Attendance.objects.get(contact=john, event=event)
    assert attendance.fit_score == 5

def test_import_apify_csv_handles_duplicates():
    event = Event.objects.create(name="Test Event", slug="test-event")
    Contact.objects.create(name="Existing John", linkedin_url="https://linkedin.com/in/johndoe")
    
    csv_content = """fullName,headline,company,linkedinUrl,about,experience
John Doe,CEO,Acme Corp,https://linkedin.com/in/johndoe,A great CEO,10 years
"""
    file_obj = SimpleUploadedFile("test.csv", csv_content.encode("utf-8"))
    
    count = import_apify_csv(file_obj, event)
    
    assert count == 1
    assert Contact.objects.count() == 1 # Still 1, just updated
    
    john = Contact.objects.get(linkedin_url="https://linkedin.com/in/johndoe")
    assert john.name == "John Doe" # Name got updated
    assert Attendance.objects.count() == 1
