import pytest
from io import BytesIO
import openpyxl
from django.core.files.uploadedfile import SimpleUploadedFile
from crm.contacts.models import Contact, Event, Attendance
from src.importer.excel_csv_importer import import_excel_or_csv

pytestmark = pytest.mark.django_db

def test_import_csv_creates_contacts_and_attendances():
    event = Event.objects.create(name="Test Event", slug="test-event")
    
    csv_content = """Name,Job Title,Company,LinkedIn URL,Summary,Experience
John Doe,CEO,Acme Corp,https://linkedin.com/in/johndoe,A great CEO,10 years
Jane Smith,CTO,Tech Inc,https://linkedin.com/in/janesmith,A great CTO,8 years
"""
    file_obj = SimpleUploadedFile("test.csv", csv_content.encode("utf-8"))
    
    count = import_excel_or_csv(file_obj, "test.csv", event)
    
    assert count == 2
    assert Contact.objects.count() == 2
    assert Attendance.objects.count() == 2
    
    john = Contact.objects.get(name="John Doe")
    assert john.company_name == "Acme Corp"
    assert john.job_title == "CEO"
    
    attendance = Attendance.objects.get(contact=john, event=event)
    assert attendance.fit_score == 3  # Neutral default score

def test_import_excel_creates_contacts_and_attendances():
    event = Event.objects.create(name="Test Event", slug="test-event")
    
    # Generate Excel in-memory
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Name", "Job Title", "Company", "LinkedIn URL", "Summary", "Experience"])
    ws.append(["Excel User", "Manager", "Excel Co", "https://linkedin.com/in/exceluser", "Excel Summary", "5 years"])
    
    out = BytesIO()
    wb.save(out)
    out.seek(0)
    
    file_obj = SimpleUploadedFile("test.xlsx", out.read())
    
    count = import_excel_or_csv(file_obj, "test.xlsx", event)
    
    assert count == 1
    assert Contact.objects.count() == 1
    assert Attendance.objects.count() == 1
    
    user = Contact.objects.get(name="Excel User")
    assert user.company_name == "Excel Co"
    assert user.job_title == "Manager"
    assert user.linkedin_url == "https://linkedin.com/in/exceluser"
