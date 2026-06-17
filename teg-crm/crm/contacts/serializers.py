from rest_framework import serializers
from .models import Event, Contact, Attendance, OutreachDraft

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = [
            "id", "name", "slug", "date", "location", "description", 
            "luma_url", "is_active", "outreach_prompt", "fit_scoring_prompt", "created_at"
        ]
        read_only_fields = ["id", "created_at"]


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            "id", "name", "company_name", "linkedin_url", "job_title", 
            "profile_summary", "experience", "about"
        ]


class AttendanceSerializer(serializers.ModelSerializer):
    contact = ContactSerializer(read_only=True)
    
    class Meta:
        model = Attendance
        fields = [
            "id", "contact", "event", "fit_score", "fit_reason", 
            "attended", "registered_at"
        ]


class OutreachDraftSerializer(serializers.ModelSerializer):
    attendance = AttendanceSerializer(read_only=True)
    
    class Meta:
        model = OutreachDraft
        fields = [
            "id", "attendance", "step_number", "generated_text", 
            "status", "created_at", "updated_at"
        ]
