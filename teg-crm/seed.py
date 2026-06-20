import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm.settings')
django.setup()

from crm.contacts.models import TeamMember, Event, Contact, RawProfileData, Rating

def seed():
    # Create Team Members
    tm1, _ = TeamMember.objects.get_or_create(name="Jonas Böhrer")
    tm2, _ = TeamMember.objects.get_or_create(name="Abdul Aljubahji")
    tm3, _ = TeamMember.objects.get_or_create(name="Markus Ramsauer")
    tm4, _ = TeamMember.objects.get_or_create(name="Niklas Loycke")

    # Create Events
    e1, _ = Event.objects.get_or_create(
        name="Global Tech Summit 2026",
        date="2026-09-15",
        luma_url="https://luma.com/gts-2026",
        outreach_prompt="We'd love to have you at the Global Tech Summit! Mention our focus on agentic AI.",
        fit_scoring_prompt="Score 5 if they have AI or CRM experience. Score 3 if they are general software engineers. Score 1 otherwise."
    )

    # Create Contacts
    c1, _ = Contact.objects.get_or_create(
        name="John Doe",
        linkedin_url="https://linkedin.com/in/johndoe",
        follow_up_owner=tm1,
        follow_up_complete=False,
        event=e1
    )
    
    # Create RawProfileData for Contact 1
    RawProfileData.objects.get_or_create(
        contact=c1,
        raw_text="John Doe\nVP of AI at TechCorp\nMunich, Germany\nPassionate about applying agentic workflows to enterprise software."
    )

    # Create Rating for Contact 1
    Rating.objects.get_or_create(
        contact=c1,
        score=5,
        reason="Has strong AI experience and works at a relevant company."
    )

    c2, _ = Contact.objects.get_or_create(
        name="Jane Roe",
        linkedin_url="https://linkedin.com/in/janeroe",
        follow_up_owner=tm2,
        follow_up_complete=True,
        event=e1
    )
    
    RawProfileData.objects.get_or_create(
        contact=c2,
        raw_text="Jane Roe\nFrontend Developer\nLondon, UK\nReact and Next.js specialist."
    )

    print("Database seeding completed successfully.")

if __name__ == '__main__':
    seed()
