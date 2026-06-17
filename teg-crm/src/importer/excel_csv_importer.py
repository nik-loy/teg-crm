import csv
import logging
from io import BytesIO, StringIO
import openpyxl
from django.db import transaction
from crm.contacts.models import Contact, Attendance, Event

logger = logging.getLogger(__name__)

def parse_header_mapping(headers):
    """
    Maps headers to standardized internal keys.
    """
    mapping = {}
    for idx, header in enumerate(headers):
        if not header:
            continue
        header_clean = str(header).strip().lower().replace("_", "").replace(" ", "")
        
        if header_clean in ("name", "fullname", "name*"):
            mapping["name"] = idx
        elif header_clean in ("linkedinurl", "url", "linkedin", "profileurl"):
            mapping["linkedin_url"] = idx
        elif header_clean in ("jobtitle", "headline", "title", "role"):
            mapping["job_title"] = idx
        elif header_clean in ("company", "companyname", "organisation", "organization", "firm"):
            mapping["company_name"] = idx
        elif header_clean in ("email", "emailaddress"):
            mapping["email"] = idx
        elif header_clean in ("experience", "workexperience"):
            mapping["experience"] = idx
        elif header_clean in ("summary", "about", "profilesummary"):
            mapping["profile_summary"] = idx
    return mapping

def import_excel_or_csv(file_obj, filename, event: Event) -> int:
    """
    Parses an Excel or CSV file of attendees and creates Contacts and Attendance links.
    """
    is_excel = filename.endswith((".xlsx", ".xls"))
    rows = []
    
    try:
        file_contents = file_obj.read()
        if is_excel:
            wb = openpyxl.load_workbook(BytesIO(file_contents), data_only=True)
            sheet = wb.active
            for r in sheet.iter_rows(values_only=True):
                if any(x is not None for x in r):
                    rows.append(list(r))
        else:
            decoded_file = file_contents.decode('utf-8-sig')
            reader = csv.reader(StringIO(decoded_file))
            for r in reader:
                rows.append(r)
    except Exception as e:
        logger.error(f"Failed to read file {filename}: {e}")
        return 0

    if not rows:
        return 0

    headers = rows[0]
    mapping = parse_header_mapping(headers)
    
    # Require at least name or linkedin_url
    if "name" not in mapping and "linkedin_url" not in mapping:
        logger.error(f"Required headers ('name' or 'linkedin_url') not found in mapping: {mapping}")
        return 0

    count = 0
    with transaction.atomic():
        for row in rows[1:]:
            # Skip empty or shorter rows
            if not row or len(row) <= max(mapping.values(), default=-1):
                continue
                
            name = str(row[mapping["name"]]).strip() if "name" in mapping and row[mapping["name"]] is not None else ""
            linkedin_url = str(row[mapping["linkedin_url"]]).strip() if "linkedin_url" in mapping and row[mapping["linkedin_url"]] is not None else ""
            
            if not name and not linkedin_url:
                continue

            # Fallback values
            if not name:
                name = "Unknown"
            
            job_title = str(row[mapping["job_title"]]).strip() if "job_title" in mapping and row[mapping["job_title"]] is not None else ""
            company_name = str(row[mapping["company_name"]]).strip() if "company_name" in mapping and row[mapping["company_name"]] is not None else ""
            profile_summary = str(row[mapping["profile_summary"]]).strip() if "profile_summary" in mapping and row[mapping["profile_summary"]] is not None else ""
            experience = str(row[mapping["experience"]]).strip() if "experience" in mapping and row[mapping["experience"]] is not None else ""
            
            # Upsert contact
            if linkedin_url:
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
            else:
                # Deduplicate by Name + Company if no LinkedIn URL is provided
                contact = Contact.objects.filter(name=name, company_name=company_name).first()
                if not contact:
                    contact = Contact.objects.create(
                        name=name,
                        job_title=job_title,
                        company_name=company_name,
                        profile_summary=profile_summary,
                        experience=experience,
                    )
                else:
                    contact.job_title = job_title
                    contact.profile_summary = profile_summary
                    contact.experience = experience
                    contact.save()
            
            # Create attendance link
            attendance, att_created = Attendance.objects.get_or_create(
                contact=contact,
                event=event,
                defaults={
                    "fit_score": 3,  # Neutral default score
                    "fit_reason": f"Imported from {filename}.",
                }
            )
            count += 1
            
    return count
