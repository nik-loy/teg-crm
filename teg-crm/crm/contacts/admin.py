"""Django Admin registration for all CRM models."""

from django.contrib import admin

from .models import (
    Attendance,
    Company,
    Contact,
    Event,
    Interaction,
    Speaker,
    TeamMember,
)


# ── Inlines ──────────────────────────────────────────────────────────────────

class InteractionInline(admin.TabularInline):
    model = Interaction
    extra = 0
    fields = ("date", "interaction_type", "summary", "next_action")
    ordering = ("-date",)


class AttendanceInline(admin.TabularInline):
    model = Attendance
    extra = 0
    fields = ("event", "attended", "notes")


# ── Model Admins ─────────────────────────────────────────────────────────────

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "industry", "is_blacklisted", "updated_at")
    list_filter = ("is_blacklisted", "industry")
    search_fields = ("name",)


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = (
        "name", "company_name", "job_title", "tier",
        "pipeline_stage", "outreach_status", "outreach_owner",
        "last_contact_date",
    )
    list_filter = ("tier", "pipeline_stage", "outreach_status", "source", "follow_up_complete")
    search_fields = ("name", "company_name", "linkedin_url", "job_title")
    list_editable = ("outreach_status", "pipeline_stage", "tier")
    date_hierarchy = "last_contact_date"
    inlines = [InteractionInline, AttendanceInline]

    fieldsets = (
        (None, {
            "fields": ("name", "linkedin_url", "job_title", "company", "company_name"),
        }),
        ("Pipeline", {
            "fields": ("tier", "pipeline_stage", "source"),
        }),
        ("Outreach", {
            "fields": ("outreach_status", "outreach_owner", "last_contact_date"),
        }),
        ("Follow-up", {
            "fields": ("follow_up_due_date", "follow_up_owner", "follow_up_complete"),
        }),
        ("Enrichment", {
            "classes": ("collapse",),
            "fields": (
                "profile_summary", "location", "experience", "education",
                "personalization_signals", "about", "mutual_connections",
                "open_to_work", "connection_degree", "languages",
                "organizations", "certifications", "website", "key_achievements",
            ),
        }),
        ("Notes", {
            "fields": ("notes",),
        }),
    )


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "date", "location", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("contact", "event", "attended", "registered_at")
    list_filter = ("event", "attended")
    search_fields = ("contact__name",)


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ("contact", "interaction_type", "summary", "date")
    list_filter = ("interaction_type", "date")
    search_fields = ("summary", "contact__name")
    date_hierarchy = "date"


@admin.register(Speaker)
class SpeakerAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "event", "confirmed")
    list_filter = ("event", "confirmed")
    search_fields = ("name", "company")


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "utm_source", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "email")
