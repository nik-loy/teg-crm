"""
CRM data models — mirrors the existing Notion database schema.

Entities:
  - Company        (the organisation a contact works for)
  - Contact        (a person in the CRM pipeline)
  - Event          (a TEG event, e.g. ACC 2026)
  - Attendance     (many-to-many: which contacts attended which events)
  - Interaction    (a logged touchpoint with a contact)
  - Speaker        (a confirmed speaker at an event)
  - TeamMember     (internal TEG team member doing outreach)
"""

from django.db import models


# ── Choices ──────────────────────────────────────────────────────────────────

class OutreachStatus(models.TextChoices):
    REQUEST_SENT = "Request Sent", "Request Sent"
    CONNECTED = "Connected", "Connected"
    MESSAGED = "Messaged", "Messaged"
    NO_RESPONSE = "No Response", "No Response"
    WITHDRAWN = "Withdrawn", "Withdrawn"


class PipelineStage(models.TextChoices):
    AWARENESS = "Awareness", "Awareness"
    FIRST_ATTENDANCE = "First Attendance", "First Attendance"
    ENGAGED = "Engaged", "Engaged"
    DEEPENING = "Deepening", "Deepening"
    ACTIVATED = "Activated", "Activated"


class Tier(models.TextChoices):
    TIER_1 = "Tier 1", "Tier 1"
    TIER_2 = "Tier 2", "Tier 2"
    TIER_3 = "Tier 3", "Tier 3"


class ContactSource(models.TextChoices):
    LINKEDIN = "LinkedIn", "LinkedIn"
    EVENT = "Event", "Event"
    REFERRAL = "Referral", "Referral"
    WEBSITE = "Website", "Website"
    OTHER = "Other", "Other"


class InteractionType(models.TextChoices):
    LINKEDIN_MESSAGE = "LinkedIn Message", "LinkedIn Message"
    EMAIL = "Email", "Email"
    MEETING = "Meeting", "Meeting"
    CALL = "Call", "Call"
    EVENT_ATTENDANCE = "Event Attendance", "Event Attendance"
    OTHER = "Other", "Other"


# ── Models ───────────────────────────────────────────────────────────────────




class Contact(models.Model):
    # Core
    name = models.CharField(max_length=255)
    linkedin_url = models.URLField(unique=True, blank=True, default="")
    job_title = models.CharField(max_length=255, blank=True)
    company_name = models.CharField(
        max_length=255, blank=True,
        help_text="Company name as text.",
    )

    # Pipeline
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.TIER_3)
    pipeline_stage = models.CharField(
        max_length=30, choices=PipelineStage.choices, default=PipelineStage.AWARENESS,
    )
    source = models.CharField(max_length=20, choices=ContactSource.choices, default=ContactSource.LINKEDIN)

    # Outreach
    outreach_status = models.CharField(
        max_length=20, choices=OutreachStatus.choices, blank=True, default="",
    )
    outreach_owner = models.CharField(max_length=100, blank=True)
    last_contact_date = models.DateField(null=True, blank=True)

    # Follow-up
    follow_up_due_date = models.DateField(null=True, blank=True)
    follow_up_owner = models.CharField(max_length=100, blank=True)
    follow_up_complete = models.BooleanField(default=False)

    # Profile enrichment
    profile_summary = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    experience = models.TextField(blank=True)
    education = models.TextField(blank=True)
    personalization_signals = models.TextField(blank=True)
    about = models.TextField(blank=True)
    mutual_connections = models.TextField(blank=True)
    open_to_work = models.BooleanField(default=False)
    connection_degree = models.CharField(max_length=10, blank=True)
    languages = models.TextField(blank=True)
    organizations = models.TextField(blank=True)
    certifications = models.TextField(blank=True)
    website = models.URLField(blank=True)
    key_achievements = models.TextField(blank=True)

    # Free-form
    notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.company_name or '—'})"


class Event(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    date = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    luma_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    outreach_prompt = models.TextField(blank=True, help_text="Event-specific base prompt template for message generation.")
    fit_scoring_prompt = models.TextField(blank=True, help_text="Prompt defining the criteria for scoring leads 1-5.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return self.name


class Attendance(models.Model):
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="attendances")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="attendances")
    registered_at = models.DateTimeField(auto_now_add=True)
    attended = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    fit_score = models.IntegerField(null=True, blank=True, help_text="AI calculated fit score (1-5) for this specific event.")
    fit_reason = models.TextField(blank=True, help_text="AI rationale for fit score.")

    class Meta:
        unique_together = ("contact", "event")
        verbose_name_plural = "attendances"

    def __str__(self):
        return f"{self.contact.name} @ {self.event.name}"


class Interaction(models.Model):
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="interactions")
    summary = models.CharField(max_length=500)
    interaction_type = models.CharField(
        max_length=30, choices=InteractionType.choices, default=InteractionType.OTHER,
    )
    date = models.DateField()
    next_action = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.interaction_type}: {self.summary[:60]}"


class Speaker(models.Model):
    name = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True)
    title = models.CharField(max_length=255, blank=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="speakers")
    linkedin_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    confirmed = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.company})"


class TeamMember(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    utm_source = models.CharField(max_length=50, blank=True, help_text="UTM tag for outreach tracking.")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class OutreachDraft(models.Model):
    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        APPROVED = "Approved", "Approved"
        REJECTED = "Rejected", "Rejected"
        SENT = "Sent", "Sent"

    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name="drafts")
    step_number = models.IntegerField(default=1, help_text="Step number in the sequence.")
    generated_text = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Draft for {self.attendance.contact.name} (Step {self.step_number})"
