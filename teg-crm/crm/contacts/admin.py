"""Django Admin registration for all CRM models."""

from django.contrib import admin

from .models import (
    Contact,
    Event,
    TeamMember,
    RawProfileData,
    Rating,
)

# ── Inlines ──────────────────────────────────────────────────────────────────

class RawProfileDataInline(admin.StackedInline):
    model = RawProfileData
    extra = 0

class RatingInline(admin.StackedInline):
    model = Rating
    extra = 0

# ── Model Admins ─────────────────────────────────────────────────────────────


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = (
        "name", "linkedin_url", "follow_up_owner", "follow_up_complete"
    )
    list_filter = ("follow_up_complete", "follow_up_owner")
    search_fields = ("name", "linkedin_url")
    inlines = [RawProfileDataInline, RatingInline]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "date", "luma_url")
    search_fields = ("name",)
    fieldsets = (
        (None, {
            "fields": ("name", "date", "luma_url")
        }),
        ("AI Prompts", {
            "fields": ("outreach_prompt", "fit_scoring_prompt"),
        }),
    )


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(RawProfileData)
class RawProfileDataAdmin(admin.ModelAdmin):
    list_display = ("contact",)


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("contact", "score")
    list_filter = ("score",)
