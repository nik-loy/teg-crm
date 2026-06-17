import csv
import logging
from io import StringIO
from django.db import transaction
from crm.contacts.models import Contact, Attendance, Event

logger = logging.getLogger(__name__)

def import_apify_csv(file_obj, event: Event):
    """
    Parses an Apify LinkedIn CSV file and creates Contacts and Attendances.
    """
    try:
        decoded_file = file_obj.read().decode('utf-8')
        reader = csv.DictReader(StringIO(decoded_file))
    except Exception as e:
        logger.error(f"Failed to read CSV: {e}")
        return 0

    count = 0
    
    with transaction.atomic():
        for row in reader:
            linkedin_url = row.get("linkedinUrl", row.get("url", "")).strip()
            if not linkedin_url:
                continue
                
            name = row.get("fullName", row.get("name", "Unknown"))
            job_title = row.get("headline", row.get("jobTitle", ""))
            company_name = row.get("company", "")
            profile_summary = row.get("summary", row.get("about", ""))
            experience = row.get("experience", "")
            
            contact, created = Contact.objects.update_or_create(
                linkedin_url=linkedin_url,
                defaults={
                    "name": name,
                    "job_title": job_title,
                    "company_name": company_name,
                    "profile_summary": profile_summary,
                    "experience": experience,
                }
            )
            
            # Create attendance
            attendance, att_created = Attendance.objects.get_or_create(
                contact=contact,
                event=event,
                defaults={
                    "fit_score": 5, # Mocked score
                    "fit_reason": "Mocked reason from Apify Importer.",
                }
            )
            count += 1
            
    return count
